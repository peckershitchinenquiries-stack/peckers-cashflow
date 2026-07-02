"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { writeAudit } from "./audit";
import { scanForAlertsBackground } from "./alerts";
import { shiftHours, todayISO } from "@/lib/utils";
import { verifyGeofenceAtStore } from "@/lib/geofence-verify";
import { hasRole } from "@/lib/types";

/** Marker note for shifts the system created from a clock-in (no rota entry). */
const AUTO_SHIFT_NOTE = "Auto-created from clock-in";

/**
 * HH:MM in UK wall-clock time. Shift times are stored as plain time-of-day, so
 * they must be derived in Europe/London — the server may run in UTC, which is
 * an hour behind UK time during BST.
 */
function londonHHMM(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

async function getEmployeeForUser(userId: string, userEmail: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .or(`auth_user_id.eq.${userId},email.eq.${userEmail.toLowerCase()}`)
    .limit(1)
    .maybeSingle();
  return data;
}

async function verifyGeofence(
  storeId: string,
  lat: number,
  lng: number,
  accuracy?: number | null,
) {
  return verifyGeofenceAtStore(createServerSupabase(), storeId, lat, lng, accuracy);
}

export async function clockIn(input: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  const employee = await getEmployeeForUser(user.id, user.email);
  if (!employee) throw new Error("Your account is not linked to a crew profile.");
  if (!employee.store_id) throw new Error("You're not assigned to a store yet.");
  if (employee.employment_status === "left" || employee.employment_status === "inactive") {
    throw new Error("Your account is not active.");
  }

  await verifyGeofence(
    employee.store_id,
    input.latitude,
    input.longitude,
    input.accuracy,
  );

  const today = todayISO();

  // Link to today's scheduled shift if one exists. Clock-in is self-service:
  // staff can clock in whenever they're on-site, with or without a shift on the
  // rota (covering a colleague, picking up an extra shift, etc.). A scheduled
  // shift simply gets attached so the Live board can compare planned vs actual.
  const { data: shift } = await supabase
    .from("rota_shifts")
    .select("id, is_day_off, start_time")
    .eq("employee_id", employee.id)
    .eq("shift_date", today)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("clock_events")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("event_date", today)
    .maybeSingle();

  if (existing?.clock_in_at) {
    throw new Error("You've already clocked in today.");
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const startTime = londonHHMM(nowDate);

  // Reflect the clock-in on the rota so the employee shows as present today.
  // Two cases need a system-managed shift (service-role client — employees
  // can't write rota_shifts under RLS):
  //   1. No shift row at all → create one (start = clock-in time).
  //   2. A row exists but it's a Day Off or has no start time → convert it to a
  //      working shift starting now. (This is the "clocked in on a day off /
  //      covering" case.) A real scheduled shift is left untouched.
  let shiftId = shift?.id ?? null;
  const needsAutoShift = !shift || shift.is_day_off || !shift.start_time;
  if (needsAutoShift) {
    const admin = createAdminClient();
    if (!shift) {
      const { data: created, error: shiftErr } = await admin
        .from("rota_shifts")
        .insert({
          employee_id: employee.id,
          store_id: employee.store_id,
          shift_date: today,
          start_time: startTime,
          end_time: null,
          is_day_off: false,
          scheduled_hours: 0,
          manager_notes: AUTO_SHIFT_NOTE,
        })
        .select("id")
        .maybeSingle();
      // Best-effort: a failed auto-shift never blocks the clock-in itself.
      if (!shiftErr && created) shiftId = created.id;
    } else {
      // Convert the existing day-off / empty shift into a worked one.
      await admin
        .from("rota_shifts")
        .update({
          start_time: startTime,
          end_time: null,
          is_day_off: false,
          scheduled_hours: 0,
          manager_notes: AUTO_SHIFT_NOTE,
        })
        .eq("id", shift.id);
      shiftId = shift.id;
    }
  }

  const payload = {
    employee_id: employee.id,
    shift_id: shiftId,
    store_id: employee.store_id,
    event_date: today,
    clock_in_at: now,
    clock_in_lat: input.latitude,
    clock_in_lng: input.longitude,
  };

  if (existing) {
    const { error } = await supabase
      .from("clock_events")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("clock_events").insert(payload);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "clock_in",
    entity: "clock_event",
    entity_id: employee.id,
    changes: { date: today, location: [input.latitude, input.longitude] },
  });

  // Auto-scan so late/variance alerts surface without a manual "Scan now".
  // Best-effort: never let a scan failure block the clock-in.
  await scanForAlertsBackground();

  revalidatePath("/employee/attendance");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  return { ok: true };
}

export async function clockOut(input: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  short_deliveries_count?: number | null;
  long_deliveries_count?: number | null;
  extra_short_deliveries?: number | null;
  extra_long_deliveries?: number | null;
  extra_short_reason?: string | null;
  extra_long_reason?: string | null;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  const employee = await getEmployeeForUser(user.id, user.email);
  if (!employee) throw new Error("Your account is not linked to a crew profile.");
  if (!employee.store_id) throw new Error("You're not assigned to a store yet.");

  await verifyGeofence(
    employee.store_id,
    input.latitude,
    input.longitude,
    input.accuracy,
  );

  const today = todayISO();
  const { data: existing } = await supabase
    .from("clock_events")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("event_date", today)
    .maybeSingle();

  if (!existing?.clock_in_at) {
    throw new Error("You haven't clocked in yet today.");
  }
  if (existing.clock_out_at) {
    throw new Error("You've already clocked out today.");
  }

  const isDriver = hasRole(employee.position, "Driver");
  const shortMissing =
    input.short_deliveries_count == null || Number.isNaN(input.short_deliveries_count);
  const longMissing =
    input.long_deliveries_count == null || Number.isNaN(input.long_deliveries_count);
  if (isDriver && shortMissing && longMissing) {
    throw new Error(
      "Drivers must enter their short and long delivery counts before clocking out.",
    );
  }
  if (
    isDriver &&
    Number(input.extra_short_deliveries) > 0 &&
    !input.extra_short_reason?.trim()
  ) {
    throw new Error("Please give a reason for the extra short deliveries.");
  }
  if (
    isDriver &&
    Number(input.extra_long_deliveries) > 0 &&
    !input.extra_long_reason?.trim()
  ) {
    throw new Error("Please give a reason for the extra long deliveries.");
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    clock_out_at: now,
    clock_out_lat: input.latitude,
    clock_out_lng: input.longitude,
  };
  if (isDriver) {
    payload.short_deliveries_count = Math.max(0, Number(input.short_deliveries_count) || 0);
    payload.long_deliveries_count = Math.max(0, Number(input.long_deliveries_count) || 0);
    const extraShort = Math.max(0, Number(input.extra_short_deliveries) || 0);
    const extraLong = Math.max(0, Number(input.extra_long_deliveries) || 0);
    payload.extra_short_deliveries = extraShort;
    payload.extra_long_deliveries = extraLong;
    payload.extra_short_reason = extraShort > 0 ? input.extra_short_reason?.trim() || null : null;
    payload.extra_long_reason = extraLong > 0 ? input.extra_long_reason?.trim() || null : null;
  }

  const { error } = await supabase
    .from("clock_events")
    .update(payload)
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  // If the shift was auto-created at clock-in, stamp its end time now so the
  // rota shows the real worked window (clock-in → clock-out).
  if (existing.shift_id) {
    const { data: shift } = await supabase
      .from("rota_shifts")
      .select("id, start_time, manager_notes")
      .eq("id", existing.shift_id)
      .maybeSingle();
    if (shift?.manager_notes === AUTO_SHIFT_NOTE && shift.start_time) {
      const endTime = londonHHMM(new Date());
      const admin = createAdminClient();
      await admin
        .from("rota_shifts")
        .update({
          end_time: endTime,
          scheduled_hours: shiftHours(shift.start_time.slice(0, 5), endTime),
        })
        .eq("id", shift.id);
    }
  }

  await writeAudit({
    action: "clock_out",
    entity: "clock_event",
    entity_id: employee.id,
    changes: {
      date: today,
      location: [input.latitude, input.longitude],
      short_deliveries: input.short_deliveries_count ?? null,
      long_deliveries: input.long_deliveries_count ?? null,
    },
  });

  // Auto-scan so early-out / scheduled-vs-actual variance surfaces immediately.
  await scanForAlertsBackground();

  revalidatePath("/employee/attendance");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  return { ok: true };
}

export async function updateDeliveryCount(input: {
  short_count: number;
  long_count: number;
  extra_short_deliveries?: number | null;
  extra_long_deliveries?: number | null;
  extra_short_reason?: string | null;
  extra_long_reason?: string | null;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  const employee = await getEmployeeForUser(user.id, user.email);
  if (!employee) throw new Error("Your account is not linked to a crew profile.");
  if (!hasRole(employee.position, "Driver")) {
    throw new Error("Only drivers can update deliveries.");
  }

  const extraShort = Math.max(0, Number(input.extra_short_deliveries) || 0);
  const extraLong = Math.max(0, Number(input.extra_long_deliveries) || 0);
  if (extraShort > 0 && !input.extra_short_reason?.trim()) {
    throw new Error("Please give a reason for the extra short deliveries.");
  }
  if (extraLong > 0 && !input.extra_long_reason?.trim()) {
    throw new Error("Please give a reason for the extra long deliveries.");
  }

  const today = todayISO();
  const { data: existing } = await supabase
    .from("clock_events")
    .select("id")
    .eq("employee_id", employee.id)
    .eq("event_date", today)
    .maybeSingle();
  if (!existing) throw new Error("No clock event for today.");

  const { error } = await supabase
    .from("clock_events")
    .update({
      short_deliveries_count: Math.max(0, Number(input.short_count) || 0),
      long_deliveries_count: Math.max(0, Number(input.long_count) || 0),
      extra_short_deliveries: extraShort,
      extra_long_deliveries: extraLong,
      extra_short_reason: extraShort > 0 ? input.extra_short_reason!.trim() : null,
      extra_long_reason: extraLong > 0 ? input.extra_long_reason!.trim() : null,
    })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "update_deliveries",
    entity: "clock_event",
    entity_id: existing.id,
    changes: { short: input.short_count, long: input.long_count, extraShort, extraLong },
  });

  revalidatePath("/employee/attendance");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  revalidatePath("/rota");
  return { ok: true };
}

/**
 * Staff (manager/admin) edit of a driver's clocked deliveries for a given day.
 * Drivers usually enter these themselves at clock-out; managers and admins can
 * correct the count or log extra deliveries (with a reason) after the fact.
 */
export async function setClockDeliveries(input: {
  employee_id: string;
  event_date: string;
  short_deliveries_count: number;
  long_deliveries_count: number;
  extra_short_deliveries?: number | null;
  extra_long_deliveries?: number | null;
  extra_short_reason?: string | null;
  extra_long_reason?: string | null;
}) {
  const user = await requireAllowed();
  if (user.allowed!.role !== "admin" && user.allowed!.role !== "manager") {
    throw new Error("Only managers and admins can edit clocked deliveries.");
  }
  const supabase = createServerSupabase();

  // Managers are limited to their own store's drivers.
  const { data: employee } = await supabase
    .from("employees")
    .select("id, store_id")
    .eq("id", input.employee_id)
    .maybeSingle();
  if (!employee) throw new Error("Employee not found.");
  if (user.allowed!.role === "manager" && employee.store_id !== user.allowed!.store_id) {
    throw new Error("You can only edit drivers at your own store.");
  }

  const shortCount = Math.max(0, Number(input.short_deliveries_count) || 0);
  const longCount = Math.max(0, Number(input.long_deliveries_count) || 0);
  const extraShort = Math.max(0, Number(input.extra_short_deliveries) || 0);
  const extraLong = Math.max(0, Number(input.extra_long_deliveries) || 0);
  if (extraShort > 0 && !input.extra_short_reason?.trim()) {
    throw new Error("Please give a reason for the extra short deliveries.");
  }
  if (extraLong > 0 && !input.extra_long_reason?.trim()) {
    throw new Error("Please give a reason for the extra long deliveries.");
  }

  const { data: existing } = await supabase
    .from("clock_events")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("event_date", input.event_date)
    .maybeSingle();

  const fields = {
    short_deliveries_count: shortCount,
    long_deliveries_count: longCount,
    extra_short_deliveries: extraShort,
    extra_long_deliveries: extraLong,
    extra_short_reason: extraShort > 0 ? input.extra_short_reason!.trim() : null,
    extra_long_reason: extraLong > 0 ? input.extra_long_reason!.trim() : null,
  };

  if (existing) {
    const { error } = await supabase.from("clock_events").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    if (!employee.store_id) throw new Error("Driver has no store assigned.");
    const { error } = await supabase.from("clock_events").insert({
      employee_id: input.employee_id,
      store_id: employee.store_id,
      event_date: input.event_date,
      ...fields,
    });
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "staff_edit_deliveries",
    entity: "clock_event",
    entity_id: existing?.id ?? input.employee_id,
    changes: { event_date: input.event_date, ...fields, by: user.email },
  });

  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  return { ok: true };
}
