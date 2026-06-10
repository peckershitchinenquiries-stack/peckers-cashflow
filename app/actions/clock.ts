"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { scanForAlertsBackground } from "./alerts";
import { haversineMeters, isWithinGeofence, todayISO } from "@/lib/utils";

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
  const supabase = createServerSupabase();
  const { data: store } = await supabase
    .from("stores")
    .select("latitude, longitude, geofence_radius_m, name")
    .eq("id", storeId)
    .maybeSingle();

  if (!store?.latitude || !store?.longitude) {
    throw new Error("Store location not configured. Contact your manager.");
  }

  const distance = haversineMeters(
    Number(store.latitude),
    Number(store.longitude),
    lat,
    lng,
  );
  const radius = Number(store.geofence_radius_m ?? 250);
  if (!isWithinGeofence(distance, radius, accuracy)) {
    throw new Error(
      `You're ${Math.round(distance)}m from ${store.name}. You must be within ${radius}m to clock in or out.`,
    );
  }
  return { distance };
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
    .select("id, is_day_off")
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

  const now = new Date().toISOString();
  const payload = {
    employee_id: employee.id,
    shift_id: shift?.id ?? null,
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
  return { ok: true };
}

export async function clockOut(input: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  deliveries_count?: number | null;
  extra_deliveries?: number | null;
  extra_delivery_reason?: string | null;
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

  const isDriver = employee.position === "Driver";
  if (isDriver && (input.deliveries_count == null || Number.isNaN(input.deliveries_count))) {
    throw new Error("Drivers must enter the number of deliveries before clocking out.");
  }
  if (
    isDriver &&
    Number(input.extra_deliveries) > 0 &&
    !input.extra_delivery_reason?.trim()
  ) {
    throw new Error("Please give a reason for the extra deliveries.");
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    clock_out_at: now,
    clock_out_lat: input.latitude,
    clock_out_lng: input.longitude,
  };
  if (isDriver) {
    payload.deliveries_count = Number(input.deliveries_count);
    const extra = Math.max(0, Number(input.extra_deliveries) || 0);
    payload.extra_deliveries = extra;
    payload.extra_delivery_reason = extra > 0 ? input.extra_delivery_reason?.trim() || null : null;
  }

  const { error } = await supabase
    .from("clock_events")
    .update(payload)
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "clock_out",
    entity: "clock_event",
    entity_id: employee.id,
    changes: {
      date: today,
      location: [input.latitude, input.longitude],
      deliveries: input.deliveries_count ?? null,
    },
  });

  // Auto-scan so early-out / scheduled-vs-actual variance surfaces immediately.
  await scanForAlertsBackground();

  revalidatePath("/employee/attendance");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  return { ok: true };
}

export async function updateDeliveryCount(input: {
  count: number;
  extra_deliveries?: number | null;
  extra_delivery_reason?: string | null;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  const employee = await getEmployeeForUser(user.id, user.email);
  if (!employee) throw new Error("Your account is not linked to a crew profile.");
  if (employee.position !== "Driver") {
    throw new Error("Only drivers can update deliveries.");
  }

  const extra = Math.max(0, Number(input.extra_deliveries) || 0);
  if (extra > 0 && !input.extra_delivery_reason?.trim()) {
    throw new Error("Please give a reason for the extra deliveries.");
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
      deliveries_count: Number(input.count),
      extra_deliveries: extra,
      extra_delivery_reason: extra > 0 ? input.extra_delivery_reason!.trim() : null,
    })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "update_deliveries",
    entity: "clock_event",
    entity_id: existing.id,
    changes: { count: input.count, extra },
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
  deliveries_count: number;
  extra_deliveries?: number | null;
  extra_delivery_reason?: string | null;
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

  const count = Math.max(0, Number(input.deliveries_count) || 0);
  const extra = Math.max(0, Number(input.extra_deliveries) || 0);
  if (extra > 0 && !input.extra_delivery_reason?.trim()) {
    throw new Error("Please give a reason for the extra deliveries.");
  }

  const { data: existing } = await supabase
    .from("clock_events")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("event_date", input.event_date)
    .maybeSingle();

  const fields = {
    deliveries_count: count,
    extra_deliveries: extra,
    extra_delivery_reason: extra > 0 ? input.extra_delivery_reason!.trim() : null,
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
