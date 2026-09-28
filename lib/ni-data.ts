// Server-side loader for the NI (monthly) summary pages — admin + manager.

import { createServerSupabase } from "./supabase-server";
import {
  PAY_CLOCK_SESSION_COLUMNS,
  resolvePayableWork,
  round2,
  worksForCash,
} from "./cash-flow";
import type { StoreClockRow, StoreClockSessionRow } from "./cash-flow";
import { roundHoursToMinute } from "./utils";
import type { ManualNiRow, NiRow } from "@/components/ni/NiMonthlyView";

/**
 * Company policy states NI hours monthly (20h/week × 52 ÷ 12 = 86.66), while
 * the pay engine applies the limit WEEKLY. This converts one to the other so
 * the constant follows the employee's own `bank_weekly_hours_limit` rather than
 * being hard-coded — anyone not on the standard 20 gets their own figure.
 */
export function monthlyNiCap(weeklyLimit: number | null | undefined): number {
  const limit = Math.max(0, Number(weeklyLimit ?? 20) || 0);
  return roundHoursToMinute((limit * 52) / 12);
}

/** How far back the summary reaches — matches the manual-row month picker. */
const MONTHS_SHOWN = 12;

/** PostgREST caps a response; day rows are read a page at a time. */
const PAGE_SIZE = 1000;

type NiEmployee = {
  id: string;
  name: string;
  store_id: string | null;
  hourly_cash_rate: number | null;
  hourly_ni_rate: number | null;
  hourly_rate: number | null;
  bank_weekly_hours_limit: number | null;
};

/** Approved work attributed to the store it was actually done at. */
type NiDayRow = {
  employee_id: string;
  store_id: string;
  event_date: string;
  hours: number;
};

/** First day of the month `MONTHS_SHOWN - 1` months back, as YYYY-MM-DD. */
function windowStartDate(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1), 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

/** One page-at-a-time read; PostgREST caps a response. */
async function loadAllPages<T>(
  run: (from: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[] | null> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from);
    if (error) return null;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}

/**
 * Approved work over the reporting window, attributed PER SHIFT to the store
 * it was worked at — never to the day header's single store, which carries the
 * last shift's store and cannot describe a day split across two (Update 224).
 *
 * Resolved through the payout's own `resolvePayableWork`, deliberately: the NI
 * allowance is decided by whether an hour was worked at the employee's home
 * store, and that must be the same hour the Tuesday sheet pays. Two rules for
 * one question is how an employee ends up over the NI cap on paper and under
 * it in the bank.
 *
 * Returns null on any failure — a partial read would silently under-report a
 * payroll month, which is worse than showing nothing.
 */
async function loadApprovedDays(
  supabase: ReturnType<typeof createServerSupabase>,
  employeeIds: string[],
  storeId: string | null,
): Promise<NiDayRow[] | null> {
  const fromDate = windowStartDate();

  // Headers are only the fallback for a pre-029 day with no shifts beneath it,
  // so neither read may be scoped by store: a day filtered out here is a day
  // whose OTHER half this store does owe.
  const [clocks, sessions] = await Promise.all([
    loadAllPages<StoreClockRow>((from) =>
      supabase
        .from("clock_events")
        .select(
          "employee_id, store_id, event_date, clock_in_at, clock_out_at, hours_approved, approved_hours",
        )
        .in("employee_id", employeeIds)
        .gte("event_date", fromDate)
        .not("clock_in_at", "is", null)
        .order("event_date", { ascending: true })
        .order("employee_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1),
    ),
    loadAllPages<StoreClockSessionRow>((from) =>
      supabase
        .from("clock_sessions")
        .select(PAY_CLOCK_SESSION_COLUMNS)
        .in("employee_id", employeeIds)
        .gte("event_date", fromDate)
        .order("event_date", { ascending: true })
        .range(from, from + PAGE_SIZE - 1),
    ),
  ]);
  if (!clocks || !sessions) return null;

  return resolvePayableWork(clocks, sessions)
    .filter((w) => w.hours > 0 && (!storeId || w.store_id === storeId))
    .map((w) => ({
      employee_id: w.employee_id,
      store_id: w.store_id,
      event_date: w.event_date,
      hours: w.hours,
    }));
}

/**
 * One NI row per employee per CALENDAR month (1st to last day), built from the
 * approved hours actually clocked on those dates. NI is capped at the monthly
 * policy figure and the remainder is cash; an employee with no cash rate is
 * paid entirely through PAYE, so no cap applies to them.
 *
 * This is a REPORTING layer only. The weekly 20h rule in lib/cash-flow.ts still
 * decides what the Tuesday payout pays, and nothing here feeds it.
 *
 * Pass `storeId` to restrict to one store (manager portal).
 */
export async function loadNiRows(storeId?: string | null): Promise<NiRow[]> {
  const supabase = createServerSupabase();

  let employeeQuery = supabase
    .from("employees")
    .select(
      "id, name, store_id, hourly_cash_rate, hourly_ni_rate, hourly_rate, bank_weekly_hours_limit",
    );
  if (storeId) employeeQuery = employeeQuery.eq("store_id", storeId);
  const employeesRes = await employeeQuery;
  if (employeesRes.error) return [];

  const empById = new Map(
    ((employeesRes.data ?? []) as NiEmployee[]).map((e) => [e.id, e]),
  );
  if (empById.size === 0) return [];

  const days = await loadApprovedDays(supabase, Array.from(empById.keys()), storeId ?? null);
  if (!days) return [];

  // `${employee_id}|${YYYY-MM}` → hours worked at the employee's HOME store.
  // Hours at any other store are cash from the first minute (cash-flow.ts), so
  // they earn no NI allowance and are excluded here rather than counted. Now
  // decided per SHIFT, so the Hitchin half of a Stevenage employee's split day
  // drops out while the Stevenage half still counts.
  const monthTotals = new Map<string, number>();
  for (const d of days) {
    const emp = empById.get(d.employee_id);
    if (!emp || d.store_id !== emp.store_id) continue;
    const key = `${d.employee_id}|${d.event_date.slice(0, 7)}`;
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + d.hours);
  }

  const out: NiRow[] = [];
  for (const [key, rawHours] of monthTotals) {
    const [employeeId, month] = key.split("|");
    const emp = empById.get(employeeId)!;
    const totalHours = roundHoursToMinute(rawHours);
    if (totalHours <= 0) continue;

    const niHours = worksForCash(emp)
      ? Math.min(totalHours, monthlyNiCap(emp.bank_weekly_hours_limit))
      : totalHours;
    const cashHours = roundHoursToMinute(totalHours - niHours);
    const niRate = Number(emp.hourly_ni_rate ?? emp.hourly_rate) || 0;
    const cashRate = Number(emp.hourly_cash_rate) || 0;

    out.push({
      store_id: emp.store_id,
      month,
      employee_id: employeeId,
      employee_name: emp.name,
      total_hours: totalHours,
      ni_hours: roundHoursToMinute(niHours),
      ni_wages: round2(niHours * niRate),
      cash_hours: cashHours,
      cash_wages: round2(cashHours * cashRate),
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
    }) => {
      const niHours = Number(r.ni_hours) || 0;
      return {
        id: r.id,
        store_id: r.store_id,
        month: r.month,
        employee_id: `manual:${r.id}`,
        employee_name: r.employee_name,
        // An off-system line is NI only — it contributes nothing to cash, so
        // the month's Total = NI + Cash still adds up with it included.
        total_hours: niHours,
        ni_hours: niHours,
        ni_wages: Number(r.ni_wages) || 0,
        cash_hours: 0,
        cash_wages: 0,
        manual: true as const,
      };
    },
  );
}
