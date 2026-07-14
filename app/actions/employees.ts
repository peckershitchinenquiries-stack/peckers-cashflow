"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { addDays, parseISODate, startOfISOWeek, toISODate } from "@/lib/utils";
import type { EmployeeHoursComputed, EmployeePosition, EmploymentStatus } from "@/lib/types";

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

export type EmployeeInput = {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  position?: string | null; // Pipe-delimited positions (e.g. "Kitchen Team Member|Driver")
  employment_start_date?: string | null;
  joined_date?: string | null;
  hourly_ni_rate?: number | null;
  hourly_cash_rate?: number | null;
  short_delivery_rate?: number | null;
  long_delivery_rate?: number | null;
  hourly_rate?: number;
  store_id?: string | null;
  bank_account_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  sort_code?: string | null;
  employment_status?: EmploymentStatus;
  notes?: string | null;
};

function buildPayload(input: EmployeeInput) {
  const niRate = Number(input.hourly_ni_rate ?? input.hourly_rate ?? 0);
  // NOTE: we intentionally do NOT manage `email` or `auth_user_id` here — those
  // are the login linkage, set once by account provisioning (accounts.ts). The
  // profile form must never overwrite them.
  return {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    date_of_birth: input.date_of_birth || null,
    gender: input.gender?.trim() || null,
    position: input.position || null,
    employment_start_date:
      input.employment_start_date || input.joined_date || null,
    joined_date: input.joined_date || input.employment_start_date || null,
    hourly_ni_rate: input.hourly_ni_rate != null ? Number(input.hourly_ni_rate) : null,
    hourly_cash_rate:
      input.hourly_cash_rate != null && input.hourly_cash_rate !== ("" as unknown as number)
        ? Number(input.hourly_cash_rate)
        : null,
    short_delivery_rate:
      input.short_delivery_rate != null && input.short_delivery_rate !== ("" as unknown as number)
        ? Number(input.short_delivery_rate)
        : null,
    long_delivery_rate:
      input.long_delivery_rate != null && input.long_delivery_rate !== ("" as unknown as number)
        ? Number(input.long_delivery_rate)
        : null,
    hourly_rate: niRate || Number(input.hourly_rate ?? 0),
    store_id: input.store_id || null,
    bank_account_name: input.bank_account_name?.trim() || null,
    bank_name: input.bank_name?.trim() || null,
    account_number: input.account_number?.trim() || null,
    sort_code: input.sort_code?.trim() || null,
    employment_status: input.employment_status || "active",
    notes: input.notes?.trim() || null,
  };
}

export async function createEmployee(input: EmployeeInput) {
  await requireAllowed();
  const supabase = createServerSupabase();
  if (!input.name?.trim()) throw new Error("Name is required");
  const ni = Number(input.hourly_ni_rate ?? input.hourly_rate ?? 0);
  if (!ni || ni <= 0) throw new Error("Hourly NI rate must be greater than 0");
  if (!input.position) throw new Error("Position is required");
  if (!input.store_id) throw new Error("Store assignment is required");

  const payload = {
    ...buildPayload(input),
    is_active: input.employment_status !== "left" && input.employment_status !== "inactive",
    bank_weekly_hours_limit: 20,
  };

  const { data, error } = await supabase
    .from("employees")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "create",
    entity: "employee",
    entity_id: data?.id ?? null,
    changes: payload,
  });

  revalidatePath("/employees");
  revalidatePath("/rota");
  return { ok: true, id: data?.id };
}

export async function updateEmployee(input: EmployeeInput) {
  if (!input.id) throw new Error("Missing employee id");
  await requireAllowed();
  const supabase = createServerSupabase();

  const payload = {
    ...buildPayload(input),
    is_active:
      input.employment_status === "left" || input.employment_status === "inactive"
        ? false
        : true,
  };

  const { error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "update",
    entity: "employee",
    entity_id: input.id,
    changes: payload,
  });

  revalidatePath("/employees");
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}

export async function archiveEmployee(id: string, archive: boolean) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("employees")
    .update({
      is_active: !archive,
      employment_status: archive ? "inactive" : "active",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({
    action: archive ? "archive" : "restore",
    entity: "employee",
    entity_id: id,
  });
  revalidatePath("/employees");
  revalidatePath("/rota");
  return { ok: true };
}

export async function reassignEmployeeStore(id: string, store_id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("employees")
    .update({ store_id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({
    action: "reassign_store",
    entity: "employee",
    entity_id: id,
    changes: { store_id },
  });
  revalidatePath("/employees");
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}

export async function logEmployeeHours(input: {
  employee_id: string;
  week_start_date: string;
  total_hours_worked: number;
  notes?: string | null;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  if (!input.employee_id) throw new Error("Select an employee");
  if (!input.week_start_date) throw new Error("Week start date required");
  if (
    input.total_hours_worked == null ||
    input.total_hours_worked <= 0 ||
    isNaN(Number(input.total_hours_worked))
  )
    throw new Error("Hours must be greater than 0");

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("hourly_rate, hourly_ni_rate")
    .eq("id", input.employee_id)
    .maybeSingle();
  if (empErr || !emp) throw new Error("Employee not found");

  const rate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);

  const { data: existing } = await supabase
    .from("employee_hours")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("week_start_date", input.week_start_date)
    .maybeSingle();

  const payload = {
    employee_id: input.employee_id,
    week_start_date: input.week_start_date,
    total_hours_worked: Number(input.total_hours_worked),
    hourly_rate_snapshot: rate,
    notes: input.notes?.trim() || null,
    logged_by: user.id,
    source: "manual" as const,
    approved: true,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("employee_hours")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("employee_hours").insert(payload);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: existing ? "update" : "create",
    entity: "employee_hours",
    entity_id: existing?.id ?? input.employee_id,
    changes: payload,
  });

  // Fetch the fresh computed rows so the client can update state immediately
  // without waiting for the router cache to clear.
  const { data: freshHours } = await supabase
    .from("employee_hours_computed")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(500);

  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/analytics");
  return { ok: true, hours: (freshHours ?? []) as EmployeeHoursComputed[] };
}

/**
 * Approve the hours an employee actually clocked for a week. The clocked total
 * is recomputed server-side from clock_events (not trusted from the client),
 * then persisted as an employee_hours row stamped approved + source 'clocked'.
 * This replaces manual weekly-hours logging for managers.
 */
export async function approveClockedHours(input: {
  employee_id: string;
  week_start_date: string;
  override_hours?: number;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  if (!input.employee_id) throw new Error("Select an employee");
  if (!input.week_start_date) throw new Error("Week start date required");

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("hourly_rate, hourly_ni_rate")
    .eq("id", input.employee_id)
    .maybeSingle();
  if (empErr || !emp) throw new Error("Employee not found");
  const rate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);

  // Recompute the week's clocked total from completed clock sessions.
  const weekEnd = toISODate(addDays(parseISODate(input.week_start_date), 6));
  const { data: events } = await supabase
    .from("clock_events")
    .select("clock_in_at, clock_out_at")
    .eq("employee_id", input.employee_id)
    .gte("event_date", input.week_start_date)
    .lte("event_date", weekEnd)
    .not("clock_out_at", "is", null);

  const clockedHours = (events ?? []).reduce((sum, ev) => {
    if (!ev.clock_in_at || !ev.clock_out_at) return sum;
    const ms = new Date(ev.clock_out_at).getTime() - new Date(ev.clock_in_at).getTime();
    return sum + Math.max(0, ms) / 3_600_000;
  }, 0);
  const clockedTotal = Math.round(clockedHours * 100) / 100;
  if (clockedTotal <= 0) {
    throw new Error("No completed clock-in/out sessions to approve for this week.");
  }

  // Manager/admin may adjust the hours before approving (e.g. correcting a
  // missed clock-out). Falls back to the recomputed clocked total otherwise.
  const hasOverride =
    input.override_hours != null && !isNaN(Number(input.override_hours));
  const totalHours = hasOverride ? Number(input.override_hours) : clockedTotal;
  if (totalHours <= 0) throw new Error("Hours must be greater than 0");
  const wasAdjusted = hasOverride && Math.abs(totalHours - clockedTotal) > 0.01;

  const { data: existing } = await supabase
    .from("employee_hours")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("week_start_date", input.week_start_date)
    .maybeSingle();

  const payload = {
    employee_id: input.employee_id,
    week_start_date: input.week_start_date,
    total_hours_worked: totalHours,
    hourly_rate_snapshot: rate,
    notes: wasAdjusted
      ? `Adjusted from clocked ${clockedTotal.toFixed(2)}h by manager`
      : null,
    logged_by: user.id,
    source: "clocked" as const,
    approved: true,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("employee_hours")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("employee_hours").insert(payload);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "approve_hours",
    entity: "employee_hours",
    entity_id: existing?.id ?? input.employee_id,
    changes: payload,
  });

  const { data: freshHours } = await supabase
    .from("employee_hours_computed")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(500);

  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/analytics");
  return { ok: true, hours: (freshHours ?? []) as EmployeeHoursComputed[] };
}

export async function deleteEmployeeHours(id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("employee_hours").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({ action: "delete", entity: "employee_hours", entity_id: id });
  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/analytics");
  return { ok: true, deletedId: id };
}

// =============================================================
// Per-DAY approval of clocked hours
//
// Managers approve one day at a time. Each approval stamps the (employee, day)
// clock_events row, then the week's employee_hours rollup is recomputed as the
// SUM of approved_hours across that week's approved days — keeping the weekly
// row (which payroll/NI/analytics read) authoritative and the 20h bank/cash
// split unchanged.
// =============================================================

type ServerSupabase = ReturnType<typeof createServerSupabase>;

async function employeeNiRate(supabase: ServerSupabase, employee_id: string) {
  const { data: emp } = await supabase
    .from("employees")
    .select("hourly_rate, hourly_ni_rate")
    .eq("id", employee_id)
    .maybeSingle();
  return Number(emp?.hourly_ni_rate ?? emp?.hourly_rate ?? 0);
}

/**
 * Recompute the weekly employee_hours rollup for one (employee, week) from the
 * approved clocked days. Removes the clocked rollup row if no day is approved.
 */
async function rollupApprovedWeek(
  supabase: ServerSupabase,
  employee_id: string,
  week_start_date: string,
  rate: number,
  userId: string,
) {
  const weekEnd = toISODate(addDays(parseISODate(week_start_date), 6));
  const { data: days } = await supabase
    .from("clock_events")
    .select("approved_hours")
    .eq("employee_id", employee_id)
    .eq("hours_approved", true)
    .gte("event_date", week_start_date)
    .lte("event_date", weekEnd);

  const total =
    Math.round(
      (days ?? []).reduce(
        (s, d) => s + (d.approved_hours != null ? Number(d.approved_hours) : 0),
        0,
      ) * 100,
    ) / 100;

  const { data: existing } = await supabase
    .from("employee_hours")
    .select("id, source")
    .eq("employee_id", employee_id)
    .eq("week_start_date", week_start_date)
    .maybeSingle();

  if (total <= 0) {
    // No approved days left this week — drop the clocked rollup row, but never
    // touch an admin's manual correction for the same week.
    if (existing && existing.source === "clocked") {
      await supabase.from("employee_hours").delete().eq("id", existing.id);
    }
    return;
  }

  const payload = {
    employee_id,
    week_start_date,
    total_hours_worked: total,
    hourly_rate_snapshot: rate,
    logged_by: userId,
    source: "clocked" as const,
    approved: true,
    approved_by: userId,
    approved_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("employee_hours")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("employee_hours").insert(payload);
    if (error) throw new Error(error.message);
  }
}

/** Refetch computed weekly rows + revalidate the pages that show hours. */
async function freshHoursResult(supabase: ServerSupabase) {
  const { data: freshHours } = await supabase
    .from("employee_hours_computed")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(500);
  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/analytics");
  return { ok: true, hours: (freshHours ?? []) as EmployeeHoursComputed[] };
}

/**
 * Approve a single clocked DAY. The day's hours are recomputed server-side from
 * the clock_events row (not trusted from the client); a manager may override to
 * correct a missed clock-out.
 */
export async function approveDailyHours(input: {
  employee_id: string;
  event_date: string;
  override_hours?: number;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();
  if (!input.employee_id) throw new Error("Select an employee");
  if (!input.event_date) throw new Error("Date required");

  const { data: ce, error: ceErr } = await supabase
    .from("clock_events")
    .select("id, clock_in_at, clock_out_at")
    .eq("employee_id", input.employee_id)
    .eq("event_date", input.event_date)
    .maybeSingle();
  if (ceErr) throw new Error(ceErr.message);
  if (!ce || !ce.clock_in_at || !ce.clock_out_at)
    throw new Error("No completed clock-in/out for this day.");

  const rawMs = new Date(ce.clock_out_at).getTime() - new Date(ce.clock_in_at).getTime();
  const rawHours = Math.round((Math.max(0, rawMs) / 3_600_000) * 100) / 100;
  const hasOverride =
    input.override_hours != null && !isNaN(Number(input.override_hours));
  const approvedHours = hasOverride ? Number(input.override_hours) : rawHours;
  if (approvedHours <= 0) throw new Error("Hours must be greater than 0");

  const { error: upErr } = await supabase
    .from("clock_events")
    .update({
      hours_approved: true,
      approved_hours: approvedHours,
      hours_approved_by: user.id,
      hours_approved_at: new Date().toISOString(),
    })
    .eq("id", ce.id);
  if (upErr) throw new Error(upErr.message);

  const rate = await employeeNiRate(supabase, input.employee_id);
  const weekStart = toISODate(startOfISOWeek(parseISODate(input.event_date)));
  await rollupApprovedWeek(supabase, input.employee_id, weekStart, rate, user.id);

  await writeAudit({
    action: "approve_daily_hours",
    entity: "clock_events",
    entity_id: ce.id,
    changes: {
      employee_id: input.employee_id,
      event_date: input.event_date,
      approved_hours: approvedHours,
    },
  });

  return freshHoursResult(supabase);
}

/** Revert a day's approval and recompute the week's rollup. */
export async function unapproveDailyHours(input: {
  employee_id: string;
  event_date: string;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();
  if (!input.employee_id) throw new Error("Select an employee");
  if (!input.event_date) throw new Error("Date required");

  const { data: ce } = await supabase
    .from("clock_events")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("event_date", input.event_date)
    .maybeSingle();
  if (!ce) throw new Error("Clock record not found.");

  const { error: upErr } = await supabase
    .from("clock_events")
    .update({
      hours_approved: false,
      approved_hours: null,
      hours_approved_by: null,
      hours_approved_at: null,
    })
    .eq("id", ce.id);
  if (upErr) throw new Error(upErr.message);

  const rate = await employeeNiRate(supabase, input.employee_id);
  const weekStart = toISODate(startOfISOWeek(parseISODate(input.event_date)));
  await rollupApprovedWeek(supabase, input.employee_id, weekStart, rate, user.id);

  await writeAudit({
    action: "unapprove_daily_hours",
    entity: "clock_events",
    entity_id: ce.id,
    changes: input,
  });

  return freshHoursResult(supabase);
}

/**
 * Approve every not-yet-approved clocked day on a given date for the supplied
 * employees (the rows a manager currently sees). One click clears a whole day.
 */
export async function approveDailyHoursForDate(input: {
  event_date: string;
  employee_ids: string[];
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();
  if (!input.event_date) throw new Error("Date required");
  const ids = Array.from(new Set((input.employee_ids ?? []).filter(Boolean)));
  if (ids.length === 0) return freshHoursResult(supabase);

  const { data: events } = await supabase
    .from("clock_events")
    .select("id, employee_id, clock_in_at, clock_out_at, hours_approved")
    .eq("event_date", input.event_date)
    .in("employee_id", ids);

  const nowIso = new Date().toISOString();
  const affected = new Set<string>();
  for (const e of events ?? []) {
    if (!e.clock_in_at || !e.clock_out_at || e.hours_approved) continue;
    const rawMs = new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime();
    const rawHours = Math.round((Math.max(0, rawMs) / 3_600_000) * 100) / 100;
    if (rawHours <= 0) continue;
    const { error } = await supabase
      .from("clock_events")
      .update({
        hours_approved: true,
        approved_hours: rawHours,
        hours_approved_by: user.id,
        hours_approved_at: nowIso,
      })
      .eq("id", e.id);
    if (error) throw new Error(error.message);
    affected.add(e.employee_id);
  }

  const weekStart = toISODate(startOfISOWeek(parseISODate(input.event_date)));
  for (const empId of affected) {
    const rate = await employeeNiRate(supabase, empId);
    await rollupApprovedWeek(supabase, empId, weekStart, rate, user.id);
  }

  await writeAudit({
    action: "approve_daily_hours_bulk",
    entity: "clock_events",
    entity_id: input.event_date,
    changes: { event_date: input.event_date, approved: affected.size },
  });

  return freshHoursResult(supabase);
}
