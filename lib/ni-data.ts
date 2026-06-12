// Server-side loader for the NI (monthly) summary pages — admin + manager.

import { createServerSupabase } from "./supabase-server";
import type { NiRow } from "@/components/ni/NiMonthlyView";
import type { EmployeeHoursComputed } from "./types";

/**
 * Approved weekly hours flattened into NI rows (one per employee-week), tagged
 * with the employee's store and the calendar month of the week's Monday.
 * Pass `storeId` to restrict to one store (manager portal).
 */
export async function loadNiRows(storeId?: string | null): Promise<NiRow[]> {
  const supabase = createServerSupabase();

  const [hoursRes, employeesRes] = await Promise.all([
    supabase
      .from("employee_hours_computed")
      .select("*")
      .eq("approved", true)
      .order("week_start_date", { ascending: false })
      .limit(2000),
    supabase.from("employees").select("id, store_id"),
  ]);

  const storeByEmployee = new Map(
    (employeesRes.data ?? []).map((e: { id: string; store_id: string | null }) => [
      e.id,
      e.store_id,
    ]),
  );

  const rows = (hoursRes.data ?? []) as EmployeeHoursComputed[];
  const out: NiRow[] = [];
  for (const r of rows) {
    const empStore = storeByEmployee.get(r.employee_id) ?? null;
    if (storeId && empStore !== storeId) continue;
    const niHours = Number(r.bank_hours) || 0;
    out.push({
      store_id: empStore,
      month: r.week_start_date.slice(0, 7),
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      ni_hours: niHours,
      ni_wages: niHours * (Number(r.hourly_rate_snapshot) || 0),
    });
  }
  return out;
}
