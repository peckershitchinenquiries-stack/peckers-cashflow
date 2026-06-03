"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { addDays, parseISODate, shiftHours, toISODate } from "@/lib/utils";
import type { EmployeeScheduleDay } from "@/lib/types";

async function requireStaff() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin" && user.allowed.role !== "manager") {
    throw new Error("Not authorised");
  }
  return user;
}

export type ScheduleDayInput = {
  weekday: number; // 0=Mon .. 6=Sun
  is_working: boolean;
  start_time?: string | null;
  end_time?: string | null;
};

/**
 * Read an employee's recurring weekly template, always returning 7 entries
 * (Mon..Sun). Missing weekdays come back as a non-working virtual day so the
 * editor can render a complete week. RLS lets staff read any; an employee can
 * read only their own.
 */
export async function getEmployeeSchedule(
  employeeId: string,
): Promise<EmployeeScheduleDay[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("employee_schedules")
    .select("*")
    .eq("employee_id", employeeId)
    .order("weekday");
  const byDay = new Map((data ?? []).map((d) => [d.weekday, d]));
  return Array.from({ length: 7 }, (_, wd) => {
    const row = byDay.get(wd);
    if (row) return row as EmployeeScheduleDay;
    return {
      id: `virtual-${employeeId}-${wd}`,
      employee_id: employeeId,
      weekday: wd,
      is_working: false,
      start_time: null,
      end_time: null,
      created_at: "",
      updated_at: "",
    } satisfies EmployeeScheduleDay;
  });
}

/** Upsert all weekdays of an employee's recurring schedule (staff only). */
export async function saveEmployeeSchedule(
  employeeId: string,
  days: ScheduleDayInput[],
): Promise<{ ok: true }> {
  const user = await requireStaff();
  const supabase = createServerSupabase();
  if (!employeeId) throw new Error("Missing employee");

  const { data: existing } = await supabase
    .from("employee_schedules")
    .select("id, weekday")
    .eq("employee_id", employeeId);
  const idByDay = new Map(
    (existing ?? []).map((r: { id: string; weekday: number }) => [r.weekday, r.id]),
  );

  for (const d of days) {
    if (d.weekday < 0 || d.weekday > 6) continue;
    const working = !!d.is_working;
    const start = working ? d.start_time?.slice(0, 5) || null : null;
    const end = working ? d.end_time?.slice(0, 5) || null : null;
    if (working && (!start || !end)) {
      throw new Error(
        "Enter both start and end times for working days, or mark the day as off.",
      );
    }

    const base = {
      is_working: working,
      start_time: start,
      end_time: end,
      updated_by: user.id,
    };
    const existingId = idByDay.get(d.weekday);
    if (existingId) {
      const { error } = await supabase
        .from("employee_schedules")
        .update(base)
        .eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("employee_schedules").insert({
        employee_id: employeeId,
        weekday: d.weekday,
        ...base,
        created_by: user.id,
      });
      if (error) throw new Error(error.message);
    }
  }

  await writeAudit({
    action: "save_schedule",
    entity: "employee_schedule",
    entity_id: employeeId,
    changes: { days },
  });

  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  return { ok: true };
}

/**
 * Generate rota_shifts for a week from employees' recurring templates.
 * Only days that exist in the template are touched; days with no template row
 * are left alone. Existing shifts are skipped unless `overwrite` is set.
 */
export async function applyScheduleToWeek(input: {
  store_id: string;
  week_start: string; // ISO Monday
  overwrite?: boolean;
  employee_ids?: string[];
}): Promise<{ ok: true; created: number; updated: number; skipped: number }> {
  const user = await requireStaff();
  const supabase = createServerSupabase();

  // Managers are locked to their own store; admins choose freely.
  const store_id =
    user.allowed!.role === "manager"
      ? user.allowed!.store_id ?? ""
      : input.store_id;
  if (!store_id) throw new Error("Missing store");
  if (!input.week_start) throw new Error("Missing week");

  const weekStart = parseISODate(input.week_start);
  const weekEnd = toISODate(addDays(weekStart, 6));

  const { data: emps } = await supabase
    .from("employees")
    .select("id")
    .eq("store_id", store_id)
    .eq("employment_status", "active");
  let employees = (emps ?? []) as Array<{ id: string }>;
  if (input.employee_ids?.length) {
    const set = new Set(input.employee_ids);
    employees = employees.filter((e) => set.has(e.id));
  }
  if (employees.length === 0) {
    return { ok: true, created: 0, updated: 0, skipped: 0 };
  }
  const empIds = employees.map((e) => e.id);

  const [{ data: schedules }, { data: existing }] = await Promise.all([
    supabase.from("employee_schedules").select("*").in("employee_id", empIds),
    supabase
      .from("rota_shifts")
      .select("id, employee_id, shift_date")
      .in("employee_id", empIds)
      .gte("shift_date", input.week_start)
      .lte("shift_date", weekEnd),
  ]);

  const schedByKey = new Map(
    (schedules ?? []).map((s: EmployeeScheduleDay) => [`${s.employee_id}:${s.weekday}`, s]),
  );
  const existingByKey = new Map(
    (existing ?? []).map((s: { id: string; employee_id: string; shift_date: string }) => [
      `${s.employee_id}:${s.shift_date}`,
      s.id,
    ]),
  );

  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  let skipped = 0;

  for (const emp of employees) {
    for (let wd = 0; wd < 7; wd++) {
      const tmpl = schedByKey.get(`${emp.id}:${wd}`);
      if (!tmpl) continue; // no template for this weekday → leave rota untouched
      const date = toISODate(addDays(weekStart, wd));
      const working = tmpl.is_working;
      const start = working ? tmpl.start_time : null;
      const end = working ? tmpl.end_time : null;
      const payload = {
        employee_id: emp.id,
        store_id,
        shift_date: date,
        start_time: start,
        end_time: end,
        is_day_off: !working,
        scheduled_hours: working ? shiftHours(start, end) : 0,
      };
      const existingId = existingByKey.get(`${emp.id}:${date}`);
      if (existingId) {
        if (input.overwrite) {
          updates.push({ id: existingId, payload: { ...payload, updated_by: user.id } });
        } else {
          skipped++;
        }
      } else {
        inserts.push({ ...payload, created_by: user.id, updated_by: user.id });
      }
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("rota_shifts").insert(inserts);
    if (error) throw new Error(error.message);
  }
  for (const u of updates) {
    const { error } = await supabase
      .from("rota_shifts")
      .update(u.payload)
      .eq("id", u.id);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "apply_schedule_to_week",
    entity: "rota_shift",
    entity_id: `${store_id}:${input.week_start}`,
    changes: {
      created: inserts.length,
      updated: updates.length,
      skipped,
      overwrite: !!input.overwrite,
    },
  });

  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  return { ok: true, created: inserts.length, updated: updates.length, skipped };
}
