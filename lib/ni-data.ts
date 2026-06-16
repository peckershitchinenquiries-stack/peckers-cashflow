// Server-side loader for the NI (monthly) summary pages — admin + manager.

import { createServerSupabase } from "./supabase-server";
import type { ManualNiRow, NiRow } from "@/components/ni/NiMonthlyView";
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
    supabase.from("employees").select("id, store_id, hourly_cash_rate"),
  ]);

  const empById = new Map(
    (employeesRes.data ?? []).map(
      (e: { id: string; store_id: string | null; hourly_cash_rate: number | null }) => [
        e.id,
        e,
      ],
    ),
  );

  const rows = (hoursRes.data ?? []) as EmployeeHoursComputed[];
  const out: NiRow[] = [];
  for (const r of rows) {
    const emp = empById.get(r.employee_id);
    const empStore = emp?.store_id ?? null;
    if (storeId && empStore !== storeId) continue;
    // Employees with no cash rate work entirely on NI — every hour counts here,
    // not just the first 20 (bank_hours). Otherwise NI hours = bank_hours.
    const worksCash = emp?.hourly_cash_rate != null && Number(emp.hourly_cash_rate) > 0;
    const niHours = worksCash
      ? Number(r.bank_hours) || 0
      : Number(r.total_hours_worked) || 0;
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

/**
 * Hand-added (off-system) NI lines, persisted per store + month. Pass `storeId`
 * to restrict to one store (manager portal). Resilient to the table not yet
 * existing (migration 005 not applied) — returns [] rather than throwing.
 */
export async function loadManualNiRows(storeId?: string | null): Promise<ManualNiRow[]> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("manual_ni_records")
    .select("id, store_id, month, employee_name, ni_hours, ni_wages")
    .order("created_at", { ascending: true });
  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(
    (r: {
      id: string;
      store_id: string;
      month: string;
      employee_name: string;
      ni_hours: number;
      ni_wages: number;
    }) => ({
      id: r.id,
      store_id: r.store_id,
      month: r.month,
      employee_id: `manual:${r.id}`,
      employee_name: r.employee_name,
      ni_hours: Number(r.ni_hours) || 0,
      ni_wages: Number(r.ni_wages) || 0,
      manual: true as const,
    }),
  );
}
