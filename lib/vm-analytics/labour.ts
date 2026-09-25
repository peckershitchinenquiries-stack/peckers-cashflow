// =============================================================
// The labour cost of a store-week, built from APPROVED hours.
//
// This is the analytics-side counterpart of `prefillLabour` (the weekly
// report): the same rules, generalised to a RANGE of weeks and grouped per
// store rather than written as editable lines. It replaces the
// `labor_cost_performance` view, which priced the ROTA, hardcoded the NI split
// at 20h and knew nothing about cover drivers, manager wages or delivery pay.
//
// Built in TypeScript, not SQL, deliberately: the NI/cash rules already live in
// lib/cash-flow.ts, and re-expressing them in a view is precisely how the old
// one got them wrong. Every money rule here is IMPORTED — nothing is restated.
//
// Read-only. It writes nothing and is safe to call from any server component.
// =============================================================

import { getCashflowSupabaseServer } from "@/lib/supabase-cashflow";
import {
  getDailyNetSalesByDay,
  getDailyNetSalesByHour,
  getExecMulti,
  getWeekdays,
} from "@/lib/vm-analytics/queries";
import { canonicalStore } from "@/lib/vm-analytics/constants";
import { londonHHMM, londonISODate } from "@/lib/utils";
import {
  approvedHoursByEmployeeStore,
  buildCoverDriverWageLines,
  buildManagerWageLines,
  buildWageLinesForStore,
  cashHoursFromStoreTotal,
  resolvePayableWork,
  round2,
  PAY_CLOCK_SESSION_COLUMNS,
  type CoverDriverPayRow,
  type ManagerPayee,
  type ManagerPayRow,
  type StoreClockRow,
  type StoreClockSessionRow,
} from "@/lib/cash-flow";
import type { Employee } from "@/lib/types";

/** One store's labour for one week, broken into the five P&L cost types. */
export type LabourWeekRow = {
  store_id: string;
  /** The ops `stores.name` — e.g. "Peckers Hitchin". */
  store: string;
  vm_store_name: string | null;
  week_start: string;
  week_end: string;

  /** Employee hours on the books (PAYE). Not paid by the Tuesday payout. */
  ni_cost: number;
  ni_hours: number;
  /** Employee hours paid in cash. */
  cash_cost: number;
  cash_hours: number;
  /** Per-drop allowance for EVERYONE — employees, managers, cover drivers. */
  delivery_cost: number;
  deliveries: number;
  /** Managers' fixed daily wage for days they clocked. Drops are above. */
  manager_cost: number;
  manager_days: number;
  manager_hours: number;
  /** Cover drivers' hourly cash. Their drops are in delivery_cost. */
  cover_driver_cost: number;
  cover_driver_hours: number;

  total_cost: number;
  /** Every paid hour: NI + cash + cover driver + manager. */
  total_hours: number;

  /** Booked rota hours for the week. Approved − this = unplanned hours. */
  rota_hours: number;
  /** Completed days at this store still waiting on Daily Approval. */
  unapproved_days: number;

  net_sales: number | null;
  revenue_source: "vm" | "cash_sheet" | null;
  /** NULL when revenue is missing or zero — never 0, which reads as perfect. */
  labour_pct: number | null;
};

export type LabourResult = {
  rows: LabourWeekRow[];
  /** A failed query must never read as "nobody worked" (Update 63). */
  load_error: string | null;
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const PAGE_SIZE = 1000;

/**
 * Every row, not the first thousand.
 *
 * PostgREST caps an unbounded select at 1000 rows and reports no error when it
 * does. A 13-week range already exceeds that on `rota_shifts`, and because the
 * rows come back in physical order the ones dropped are the most recently
 * inserted — the very week the page is showing. It read as 336 hours of
 * unplanned labour on a week whose real variance was four.
 */
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: out, error: error.message };
    const page = data ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) return { data: out, error: null };
  }
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekEndOf(weekStart: string): string {
  return addDaysIso(weekStart, 6);
}

type StoreRow = { id: string; name: string; vm_store_name: string | null };

type ManagerRow = ManagerPayee & { fixed_daily_wage: number | null };

type ManagerClockRow = ManagerPayRow & {
  clock_in_at: string | null;
  clock_out_at: string | null;
  worked_hours: number | string | null;
  deliveries_approved: boolean | null;
};

type CoverRow = CoverDriverPayRow & { approved: boolean };

type RotaRow = {
  store_id: string | null;
  shift_date: string;
  scheduled_hours: number | string | null;
  is_day_off: boolean | null;
};

type CashEntryRow = {
  store_id: string;
  entry_date: string;
  vita_mojo_sales: number | string | null;
};

function emptyRow(store: StoreRow, weekStart: string): LabourWeekRow {
  return {
    store_id: store.id,
    store: store.name,
    vm_store_name: store.vm_store_name,
    week_start: weekStart,
    week_end: weekEndOf(weekStart),
    ni_cost: 0,
    ni_hours: 0,
    cash_cost: 0,
    cash_hours: 0,
    delivery_cost: 0,
    deliveries: 0,
    manager_cost: 0,
    manager_days: 0,
    manager_hours: 0,
    cover_driver_cost: 0,
    cover_driver_hours: 0,
    total_cost: 0,
    total_hours: 0,
    rota_hours: 0,
    unapproved_days: 0,
    net_sales: null,
    revenue_source: null,
    labour_pct: null,
  };
}

/**
 * Labour cost for every store across the given weeks.
 *
 * ONE round trip per source table for the WHOLE range — a 13-week trend costs
 * the same number of queries as a single week, bounded by the range's dates.
 *
 * Hours are attributed by `clock_events.store_id` (where the shift was worked),
 * never the employee's home store, so cross-cover lands on the right P&L. But
 * each employee's FULL week is read across all stores, because the NI/cash
 * split is a per-EMPLOYEE weekly rule — see cashHoursFromStoreTotal.
 */
export async function getLabourByStoreWeek(
  weekStartIsos: string[],
): Promise<LabourResult> {
  const weeks = Array.from(new Set(weekStartIsos)).sort();
  if (weeks.length === 0) return { rows: [], load_error: null };

  const rangeStart = weeks[0];
  const rangeEnd = weekEndOf(weeks[weeks.length - 1]);

  const sb = getCashflowSupabaseServer();
  const [
    storesRes,
    employeesRes,
    clocksRes,
    coverRes,
    managersRes,
    managerClocksRes,
    rotaRes,
    cashRes,
    sessionsRes,
  ] = await Promise.all([
    fetchAllRows<StoreRow>((a, b) =>
      sb.from("stores").select("id, name, vm_store_name").range(a, b),
    ),
    // Leavers included: someone marked "left" still worked the week being costed.
    fetchAllRows<Employee>((a, b) => sb.from("employees").select("*").range(a, b)),
    fetchAllRows<StoreClockRow>((a, b) =>
      sb
        .from("clock_events")
        .select(
          "employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, hours_approved, approved_hours, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
        )
        .gte("event_date", rangeStart)
        .lte("event_date", rangeEnd)
        .range(a, b),
    ),
    fetchAllRows<CoverRow>((a, b) =>
      sb
        .from("cover_driver_hours_computed")
        .select(
          "cover_driver_id, driver_name, store_id, work_date, total_hours_worked, hourly_rate_snapshot, short_deliveries, long_deliveries, extra_short_deliveries, extra_long_deliveries, short_rate_snapshot, long_rate_snapshot, approved",
        )
        .gte("work_date", rangeStart)
        .lte("work_date", rangeEnd)
        .range(a, b),
    ),
    fetchAllRows<ManagerRow>((a, b) =>
      sb
        .from("allowed_users")
        .select(
          "id, name, fixed_daily_wage, short_delivery_rate, long_delivery_rate, extra_short_delivery_rate, extra_long_delivery_rate",
        )
        .eq("role", "manager")
        .range(a, b),
    ),
    fetchAllRows<ManagerClockRow>((a, b) =>
      sb
        .from("manager_clock_events")
        .select(
          "manager_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, deliveries_approved, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
        )
        .gte("event_date", rangeStart)
        .lte("event_date", rangeEnd)
        .range(a, b),
    ),
    fetchAllRows<RotaRow>((a, b) =>
      sb
        .from("rota_shifts")
        .select("store_id, shift_date, scheduled_hours, is_day_off")
        .gte("shift_date", rangeStart)
        .lte("shift_date", rangeEnd)
        .range(a, b),
    ),
    fetchAllRows<CashEntryRow>((a, b) =>
      sb
        .from("daily_cash_entries")
        .select("store_id, entry_date, vita_mojo_sales")
        .gte("entry_date", rangeStart)
        .lte("entry_date", rangeEnd)
        .range(a, b),
    ),
    // The individual shifts. A day worked at BOTH stores carries only the last
    // shift's store on its header, so per-store hours and cost have to be
    // summed from these or the whole day lands on one store's P&L.
    fetchAllRows<StoreClockSessionRow>((a, b) =>
      sb
        .from("clock_sessions")
        .select(PAY_CLOCK_SESSION_COLUMNS)
        .gte("event_date", rangeStart)
        .lte("event_date", rangeEnd)
        .range(a, b),
    ),
  ]);

  const loadError =
    storesRes.error ??
    employeesRes.error ??
    clocksRes.error ??
    coverRes.error ??
    managersRes.error ??
    managerClocksRes.error ??
    rotaRes.error ??
    cashRes.error ??
    sessionsRes.error ??
    null;
  if (loadError) {
    return { rows: [], load_error: `Couldn't read the week's hours: ${loadError}` };
  }

  const stores = storesRes.data;
  const employees = employeesRes.data;
  const clocks = clocksRes.data;
  const cover = coverRes.data;
  const managers = managersRes.data;
  const managerClocks = managerClocksRes.data;
  const rota = rotaRes.data;
  const cashEntries = cashRes.data;
  const sessions = sessionsRes.data;

  // VM net sales for the whole range in one query. A VM outage must not break
  // the cost half of the page, so it degrades to the cash sheet instead.
  let vmNetByStoreWeek = new Map<string, number>();
  let vmError: string | null = null;
  try {
    for (const e of await getExecMulti(weeks)) {
      const weekIso = String(e.week_start).slice(0, 10);
      vmNetByStoreWeek.set(`${e.store}|${weekIso}`, num(e.net_sales));
    }
  } catch (err) {
    vmNetByStoreWeek = new Map();
    vmError = err instanceof Error ? err.message : "VM sales unavailable";
  }

  const managerById = new Map(managers.map((m) => [m.id, m]));
  const rows: LabourWeekRow[] = [];

  for (const weekStart of weeks) {
    const weekEnd = weekEndOf(weekStart);
    const inWeek = (d: string | null | undefined) =>
      !!d && d >= weekStart && d <= weekEnd;

    const weekClocks = clocks.filter((c) => inWeek(c.event_date));
    const weekSessions = sessions.filter((s) => inWeek(s.event_date));
    const weekHoursByEmpStore = approvedHoursByEmployeeStore(weekClocks, weekSessions);
    const weekCover = cover.filter((c) => inWeek(c.work_date));
    const weekManagerClocks = managerClocks.filter((c) => inWeek(c.event_date));
    const weekRota = rota.filter((r) => inWeek(r.shift_date));
    const weekCash = cashEntries.filter((c) => inWeek(c.entry_date));

    for (const store of stores) {
      const row = emptyRow(store, weekStart);
      const storeId = store.id;

      // ---- employees: NI + cash + their drops ----------------------------
      // The builder sees the employee's whole week across ALL stores and
      // returns only what is payable AT this one.
      const wageLines = new Map(
        buildWageLinesForStore(storeId, employees, weekClocks, weekSessions).map((l) => [
          l.employee_id,
          l,
        ]),
      );

      for (const emp of employees) {
        // Per SHIFT, not per day — a day split across both stores owes each
        // store only the hours worked there.
        const hoursAtStore = round2(
          weekHoursByEmpStore.get(`${emp.id}:${storeId}`) ?? 0,
        );
        const wage = wageLines.get(emp.id);
        if (hoursAtStore <= 0 && !wage) continue;

        const cashHours = wage
          ? num(wage.cash_hours)
          : round2(cashHoursFromStoreTotal(hoursAtStore, storeId, emp));
        const niHours = round2(Math.max(0, hoursAtStore - cashHours));
        const niRate =
          emp.hourly_ni_rate != null ? num(emp.hourly_ni_rate) : num(emp.hourly_rate);

        row.ni_hours += niHours;
        row.ni_cost += round2(niHours * niRate);
        row.cash_hours += cashHours;
        row.cash_cost += num(wage?.cash_wage);
        row.delivery_cost += num(wage?.delivery_wages);
        row.deliveries += wage
          ? (wage.short_deliveries_count ?? 0) +
            (wage.long_deliveries_count ?? 0) +
            (wage.short_misc_count ?? 0) +
            (wage.long_misc_count ?? 0)
          : 0;
      }

      // ---- cover drivers: cash hours here, drops into the delivery row ----
      for (const line of buildCoverDriverWageLines(storeId, weekCover)) {
        row.cover_driver_hours += num(line.cash_hours);
        row.cover_driver_cost += num(line.cash_wage);
        row.delivery_cost += num(line.delivery_wages);
        row.deliveries +=
          (line.short_deliveries_count ?? 0) +
          (line.long_deliveries_count ?? 0) +
          (line.short_misc_count ?? 0) +
          (line.long_misc_count ?? 0);
      }

      // ---- managers: fixed daily wage + their drops ------------------------
      // A deliveries-only row (migration 037) carries a null clock_in_at and is
      // correctly not a day worked, so it earns no daily wage.
      for (const d of weekManagerClocks) {
        if (d.store_id !== storeId) continue;
        if (!d.clock_in_at) continue;
        const mgr = managerById.get(d.manager_id);
        if (!mgr) continue;
        row.manager_days += 1;
        row.manager_hours += num(d.worked_hours);
        row.manager_cost += num(mgr.fixed_daily_wage);
      }
      for (const line of buildManagerWageLines(storeId, managers, weekManagerClocks)) {
        row.delivery_cost += num(line.delivery_wages);
        row.deliveries +=
          (line.short_deliveries_count ?? 0) +
          (line.long_deliveries_count ?? 0) +
          (line.short_misc_count ?? 0) +
          (line.long_misc_count ?? 0);
      }

      // ---- the plan, for the unplanned-hours comparison --------------------
      row.rota_hours = round2(
        weekRota
          .filter((r) => r.store_id === storeId && !r.is_day_off)
          .reduce((t, r) => t + num(r.scheduled_hours), 0),
      );

      // ---- what is still waiting on Daily Approval ------------------------
      // Mirrors countUnapprovedDays in app/actions/weekly-report.ts: completed
      // days only, across all three groups.
      row.unapproved_days =
        weekClocks.filter(
          (c) =>
            c.store_id === storeId &&
            c.clock_in_at &&
            c.clock_out_at &&
            c.hours_approved === false,
        ).length +
        weekCover.filter((c) => c.store_id === storeId && !c.approved).length +
        weekManagerClocks.filter(
          (c) =>
            c.store_id === storeId && c.clock_out_at && c.deliveries_approved === false,
        ).length;

      row.ni_cost = round2(row.ni_cost);
      row.ni_hours = round2(row.ni_hours);
      row.cash_cost = round2(row.cash_cost);
      row.cash_hours = round2(row.cash_hours);
      row.delivery_cost = round2(row.delivery_cost);
      row.manager_cost = round2(row.manager_cost);
      row.manager_hours = round2(row.manager_hours);
      row.cover_driver_cost = round2(row.cover_driver_cost);
      row.cover_driver_hours = round2(row.cover_driver_hours);
      row.total_cost = round2(
        row.ni_cost +
          row.cash_cost +
          row.delivery_cost +
          row.manager_cost +
          row.cover_driver_cost,
      );
      row.total_hours = round2(
        row.ni_hours + row.cash_hours + row.cover_driver_hours + row.manager_hours,
      );

      // ---- revenue: VM net sales, cash sheet only as a fallback ------------
      const vmNet = store.vm_store_name
        ? vmNetByStoreWeek.get(`${store.vm_store_name}|${weekStart}`)
        : undefined;
      if (vmNet != null && vmNet > 0) {
        row.net_sales = round2(vmNet);
        row.revenue_source = "vm";
      } else {
        const sheet = weekCash
          .filter((c) => c.store_id === storeId)
          .reduce((t, c) => t + num(c.vita_mojo_sales), 0);
        if (sheet > 0) {
          row.net_sales = round2(sheet);
          row.revenue_source = "cash_sheet";
        }
      }
      // Never 0 — a week with no revenue row is UNKNOWN, not perfect control.
      row.labour_pct =
        row.net_sales != null && row.net_sales > 0
          ? round2((row.total_cost / row.net_sales) * 100)
          : null;

      rows.push(row);
    }
  }

  return { rows, load_error: vmError ? `VM net sales unavailable: ${vmError}` : null };
}

// =============================================================
// Weeks the labour page can offer
// =============================================================

/**
 * The weeks that actually hold clocked work, newest first.
 *
 * Replaces reading `labor_cost_performance` for the week list. The view is left
 * in the database (the currently deployed build still reads it) but nothing in
 * the app points at it any more.
 *
 * Bounded to the last `lookbackWeeks` weeks and to COMPLETED weeks only: the
 * in-progress week has days nobody has approved yet, so costing it would read
 * as a collapse in labour spend rather than as a week still in flight.
 */
export async function getLabourWeeks(
  lookbackWeeks = 52,
): Promise<{ week_start: string; week_end: string; week_start_iso: string }[]> {
  const now = new Date();
  const day = now.getUTCDay();
  const thisMonday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + (day === 0 ? -6 : 1 - day),
    ),
  )
    .toISOString()
    .slice(0, 10);
  const from = addDaysIso(thisMonday, -7 * lookbackWeeks);

  const sb = getCashflowSupabaseServer();
  const { data, error } = await sb
    .from("clock_events")
    .select("event_date")
    .gte("event_date", from)
    .lt("event_date", thisMonday)
    .not("clock_in_at", "is", null);
  if (error) throw new Error(`getLabourWeeks: ${error.message}`);

  const seen = new Set<string>();
  for (const r of data ?? []) {
    const d = new Date(`${(r as { event_date: string }).event_date}T00:00:00Z`);
    const wd = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (wd === 0 ? -6 : 1 - wd));
    seen.add(d.toISOString().slice(0, 10));
  }

  return Array.from(seen)
    .sort((a, b) => b.localeCompare(a))
    .map((w) => ({ week_start: w, week_end: weekEndOf(w), week_start_iso: w }));
}

/**
 * Each store-week's own labour budget, as a PERCENTAGE (30, not 0.30).
 * `weekly_reports.labour_budget_pct` is stored as a decimal fraction.
 */
export async function getLabourTargets(
  weekStartIsos: string[],
): Promise<Map<string, number>> {
  const targets = new Map<string, number>();
  if (weekStartIsos.length === 0) return targets;
  const sb = getCashflowSupabaseServer();
  const { data } = await sb
    .from("weekly_reports")
    .select("store_id, week_start, labour_budget_pct")
    .in("week_start", weekStartIsos);
  for (const r of (data ?? []) as Array<{
    store_id: string;
    week_start: string;
    labour_budget_pct: number | string | null;
  }>) {
    const decimal = num(r.labour_budget_pct);
    if (decimal > 0) targets.set(`${r.store_id}|${r.week_start}`, round2(decimal * 100));
  }
  return targets;
}

// =============================================================
// Labour against demand, by day of week
// =============================================================

export type LabourDayRow = {
  weekday_id: number;
  weekday: string;
  net_sales: number | null;
  /** False when net_sales is the gross-shape estimate, not the daily net feed. */
  net_exact: boolean;
  hours: number;
  cost: number;
  labour_pct: number | null;
  splh: number | null;
};

export type LabourWeekdayStore = {
  store_id: string;
  store: string;
  vm_store_name: string | null;
  days: LabourDayRow[];
};

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Split one week of labour across its seven days. The day costs sum back to
 * that week's total_cost to within a penny or two of per-day rounding — it is
 * a real decomposition, not an apportionment by share of hours.
 *
 * The NI/cash boundary falls mid-week, not mid-day, so this is not a per-day
 * re-run of the weekly rule: each employee HOME-store day is walked in date
 * order and priced as NI until their weekly bank limit is used up, then as
 * cash. Secondary-store days are cash throughout, and someone with no cash rate
 * is NI throughout — the three rules cashHoursFromStoreTotal applies to a week,
 * distributed over it.
 *
 * Delivery, manager and cover-driver money is already per-day, so it is priced
 * by handing the SAME builders that cost the week a single day of rows.
 *
 * Hours come from the signed-off `clock_sessions` through resolvePayableWork,
 * the same path the Tuesday payout uses — so a day split across both stores
 * costs each store only the shifts worked there.
 */
export async function getLabourWeekdayBreakdown(
  weekStart: string,
): Promise<{ stores: LabourWeekdayStore[]; load_error: string | null }> {
  const weekEnd = weekEndOf(weekStart);
  const sb = getCashflowSupabaseServer();

  const [
    storesRes,
    employeesRes,
    clocksRes,
    coverRes,
    managersRes,
    managerClocksRes,
    sessionsRes,
  ] = await Promise.all([
      sb.from("stores").select("id, name, vm_store_name"),
      sb.from("employees").select("*"),
      sb
        .from("clock_events")
        .select(
          "employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, hours_approved, approved_hours, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
        )
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("cover_driver_hours_computed")
        .select(
          "cover_driver_id, driver_name, store_id, work_date, total_hours_worked, hourly_rate_snapshot, short_deliveries, long_deliveries, extra_short_deliveries, extra_long_deliveries, short_rate_snapshot, long_rate_snapshot, approved",
        )
        .gte("work_date", weekStart)
        .lte("work_date", weekEnd),
      sb
        .from("allowed_users")
        .select(
          "id, name, fixed_daily_wage, short_delivery_rate, long_delivery_rate, extra_short_delivery_rate, extra_long_delivery_rate",
        )
        .eq("role", "manager"),
      sb
        .from("manager_clock_events")
        .select(
          "manager_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, deliveries_approved, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
        )
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("clock_sessions")
        .select(PAY_CLOCK_SESSION_COLUMNS)
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
    ]);

  const loadError =
    storesRes.error?.message ??
    sessionsRes.error?.message ??
    employeesRes.error?.message ??
    clocksRes.error?.message ??
    coverRes.error?.message ??
    managersRes.error?.message ??
    managerClocksRes.error?.message ??
    null;
  if (loadError) return { stores: [], load_error: loadError };

  const stores = (storesRes.data ?? []) as StoreRow[];
  const employees = (employeesRes.data ?? []) as Employee[];
  const clocks = (clocksRes.data ?? []) as StoreClockRow[];
  const cover = (coverRes.data ?? []) as CoverRow[];
  const managers = (managersRes.data ?? []) as ManagerRow[];
  const managerClocks = (managerClocksRes.data ?? []) as ManagerClockRow[];
  const sessions = (sessionsRes.data ?? []) as StoreClockSessionRow[];
  const payableWork = resolvePayableWork(clocks, sessions);
  const managerById = new Map(managers.map((m) => [m.id, m]));
  const empById = new Map(employees.map((e) => [e.id, e]));

  // True per-day NET sales, keyed store slug -> ISO date. Coverage starts
  // 2026-03-02; older weeks fall through to the gross-shape estimate below.
  const netByStoreDate = new Map<string, Map<string, number>>();
  let dailyNetError: string | null = null;
  try {
    for (const d of await getDailyNetSalesByDay(weekStart, weekEnd)) {
      const slug = (d.store_slug ?? "").toLowerCase();
      if (!slug) continue;
      const m = netByStoreDate.get(slug) ?? new Map<string, number>();
      m.set(String(d.business_date).slice(0, 10), num(d.net_sales));
      netByStoreDate.set(slug, m);
    }
  } catch (err) {
    dailyNetError = err instanceof Error ? err.message : "daily net sales unavailable";
  }

  // Fallback only, for dates the daily feed doesn't cover. The weekday view
  // carries GROSS revenue, so it is used as the SHAPE and scaled to the week VM
  // net total. Mixing gross days into a net labour % would read low.
  const shapeByStore = new Map<string, Map<number, number>>();
  let weekdayError: string | null = null;
  try {
    for (const w of await getWeekdays(weekStart)) {
      const m = shapeByStore.get(w.store) ?? new Map<number, number>();
      m.set(num(w.weekday_id), num(w.revenue));
      shapeByStore.set(w.store, m);
    }
  } catch (err) {
    weekdayError = err instanceof Error ? err.message : "weekday sales unavailable";
  }
  const week = await getLabourByStoreWeek([weekStart]);

  const out: LabourWeekdayStore[] = [];
  for (const store of stores) {
    const storeId = store.id;
    const weekRow = week.rows.find((r) => r.store_id === storeId);

    // NI budget per employee, spent in date order across their HOME-store days.
    const niBudget = new Map<string, number>();
    for (const emp of employees) {
      if (emp.store_id !== storeId) continue;
      niBudget.set(
        emp.id,
        emp.hourly_cash_rate != null && num(emp.hourly_cash_rate) > 0
          ? Math.max(0, num(emp.bank_weekly_hours_limit ?? 20))
          : Number.POSITIVE_INFINITY,
      );
    }

    const dayHours = new Map<string, number>();
    const dayCost = new Map<string, number>();
    const bump = (date: string, hours: number, cost: number) => {
      dayHours.set(date, (dayHours.get(date) ?? 0) + hours);
      dayCost.set(date, (dayCost.get(date) ?? 0) + cost);
    };

    // Per SHIFT, not per day: a day split across both stores contributes its
    // afternoon here and its evening to the other store, on the same date.
    const storeDays = payableWork
      .filter((p) => p.store_id === storeId && p.hours > 0)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    for (const c of storeDays) {
      const emp = empById.get(c.employee_id);
      if (!emp) continue;
      const hours = c.hours;
      let ni = 0;
      if (emp.store_id === storeId) {
        const left = niBudget.get(emp.id) ?? 0;
        ni = Math.min(hours, left);
        if (Number.isFinite(left)) niBudget.set(emp.id, left - ni);
      }
      const cash = Math.max(0, hours - ni);
      const niRate = emp.hourly_ni_rate != null ? num(emp.hourly_ni_rate) : num(emp.hourly_rate);
      bump(c.event_date, hours, ni * niRate + cash * num(emp.hourly_cash_rate));
    }

    for (let i = 0; i < 7; i++) {
      const date = addDaysIso(weekStart, i);
      const dayDelivery = buildWageLinesForStore(
        storeId,
        employees,
        clocks.filter((c) => c.event_date === date),
        sessions.filter((x) => x.event_date === date),
      ).reduce((t, l) => t + num(l.delivery_wages), 0);

      const dayManagerClocks = managerClocks.filter((c) => c.event_date === date);
      let managerCost = buildManagerWageLines(storeId, managers, dayManagerClocks).reduce(
        (t, l) => t + num(l.delivery_wages),
        0,
      );
      let managerHours = 0;
      for (const d of dayManagerClocks) {
        if (d.store_id !== storeId || !d.clock_in_at) continue;
        managerCost += num(managerById.get(d.manager_id)?.fixed_daily_wage);
        managerHours += num(d.worked_hours);
      }

      let coverCost = 0;
      let coverHours = 0;
      for (const l of buildCoverDriverWageLines(
        storeId,
        cover.filter((c) => c.work_date === date),
      )) {
        coverCost += num(l.total_payment);
        coverHours += num(l.cash_hours);
      }

      bump(date, managerHours + coverHours, dayDelivery + managerCost + coverCost);
    }

    const shape = store.vm_store_name ? shapeByStore.get(store.vm_store_name) : undefined;
    const shapeTotal = shape ? Array.from(shape.values()).reduce((a, b) => a + b, 0) : 0;
    const weekNet = weekRow?.net_sales ?? null;
    const exactNet = store.vm_store_name
      ? netByStoreDate.get(canonicalStore(store.vm_store_name).toLowerCase())
      : undefined;

    const days: LabourDayRow[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysIso(weekStart, i);
      // vm_v_daypart_weekday numbers Monday as 1.
      const shapeShare = shape?.get(i + 1) ?? 0;
      const estimate =
        weekNet != null && shapeTotal > 0 ? round2((shapeShare / shapeTotal) * weekNet) : null;
      const exact = exactNet?.get(date);
      const netSales = exact != null ? round2(exact) : estimate;
      const hours = round2(dayHours.get(date) ?? 0);
      const cost = round2(dayCost.get(date) ?? 0);
      days.push({
        weekday_id: i + 1,
        weekday: WEEKDAYS[i],
        net_sales: netSales,
        net_exact: exact != null,
        hours,
        cost,
        labour_pct: netSales != null && netSales > 0 ? round2((cost / netSales) * 100) : null,
        splh: hours > 0 && netSales != null ? round2(netSales / hours) : null,
      });
    }

    out.push({ store_id: storeId, store: store.name, vm_store_name: store.vm_store_name, days });
  }

  // The gross-shape fallback only matters where the daily net feed is absent,
  // so a weekday-view failure is not an error while that feed is answering.
  const netUnavailable = netByStoreDate.size === 0;
  return { stores: out, load_error: netUnavailable ? (weekdayError ?? dailyNetError) : null };
}

// =============================================================
// Labour against demand, by hour of day
// =============================================================

export type LabourHourCell = { staffed_hours: number; net_sales: number | null };

export type LabourHourGrid = {
  store_id: string;
  store: string;
  /** Trading hours the VM feed reports for this store-week, contiguous. */
  hours: number[];
  /** [hour][weekday] — weekday 0 is Monday. */
  cells: LabourHourCell[][];
  /** Per weekday: paid hours worked outside the trading window. */
  outside_hours: number[];
  /** Sales per staffed hour across the whole week, the grid's own benchmark. */
  splh: number | null;
};

const HOUR_MS = 3600000;

/**
 * The instant re-expressed so that reading it as UTC gives London wall-clock
 * time. Differences between two of these are elapsed WALL-CLOCK hours, which is
 * what a staffing grid wants. Never Date#getHours() — the server runs in UTC.
 */
function londonWall(iso: string): number {
  const d = new Date(iso);
  return Date.parse(`${londonISODate(d)}T${londonHHMM(d)}:00Z`);
}

/** Split a wall-clock window across the hour buckets it overlaps. */
function spreadOverHours(
  startWall: number,
  endWall: number,
  add: (hour: number, hours: number) => void,
): void {
  if (!(endWall > startWall)) return;
  for (let t = Math.floor(startWall / HOUR_MS) * HOUR_MS; t < endWall; t += HOUR_MS) {
    const overlap = Math.min(t + HOUR_MS, endWall) - Math.max(t, startWall);
    if (overlap > 0) add(new Date(t).getUTCHours(), overlap / HOUR_MS);
  }
}

/** One person's shifts on one trading day, before scaling to approved hours. */
type ShiftDay = {
  store_id: string;
  /** The TRADING day the shifts settle on, not the calendar day they end on. */
  event_date: string;
  windows: Array<{ start: string; end: string }>;
  target_hours: number;
};

type HourSessionRow = {
  store_id: string | null;
  event_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
};

/**
 * Staffing against demand, hour by hour.
 *
 * Demand is the VM per-hour net sales feed; supply is the clock SESSIONS, which
 * carry the in/out timestamps the day header has already collapsed away.
 *
 * Two things this deliberately does not do:
 *
 * 1. It does not put a shift's post-midnight tail on the next calendar day.
 *    14% of shifts cross midnight and VM reports no sales after 22:00 — its
 *    business date closes with trade. Hours are pinned to the session's
 *    `event_date`, the trading day it settles on, as the payout treats them.
 * 2. It does not show hours outside the trading window as cells. Closing,
 *    cleaning and prep are real but have no sales to be measured against, so
 *    they are summed into `outside_hours` rather than reading as a red cell of
 *    infinite overstaffing.
 *
 * Each person-day's raw windows are SCALED to sum to that day's approved hours.
 * A manager correcting a bad auto clock-out at approval moves the paid figure
 * and not the timestamps, so unscaled windows would disagree with the weekday
 * table directly above this grid — currently by about 3% of all hours.
 */
export async function getLabourHourlyCoverage(
  weekStart: string,
): Promise<{ stores: LabourHourGrid[]; load_error: string | null }> {
  const weekEnd = weekEndOf(weekStart);
  const sb = getCashflowSupabaseServer();

  const [storesRes, sessionsRes, dayRes, mgrSessRes, mgrDayRes, coverClockRes, coverHoursRes] =
    await Promise.all([
      sb.from("stores").select("id, name, vm_store_name"),
      sb
        .from("clock_sessions")
        .select("employee_id, store_id, event_date, clock_in_at, clock_out_at")
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("clock_events")
        .select("employee_id, store_id, event_date, approved_hours")
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("manager_clock_sessions")
        .select("manager_id, store_id, event_date, clock_in_at, clock_out_at, deliveries_only")
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("manager_clock_events")
        .select("manager_id, store_id, event_date, worked_hours")
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("cover_driver_clock_events")
        .select("cover_driver_id, store_id, event_date, clock_in_at, clock_out_at")
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd),
      sb
        .from("cover_driver_hours_computed")
        .select("cover_driver_id, store_id, work_date, total_hours_worked, approved")
        .gte("work_date", weekStart)
        .lte("work_date", weekEnd),
    ]);

  const loadError =
    storesRes.error?.message ??
    sessionsRes.error?.message ??
    dayRes.error?.message ??
    mgrSessRes.error?.message ??
    mgrDayRes.error?.message ??
    coverClockRes.error?.message ??
    coverHoursRes.error?.message ??
    null;
  if (loadError) {
    return { stores: [], load_error: `Couldn't read the week's shifts: ${loadError}` };
  }

  const stores = (storesRes.data ?? []) as StoreRow[];
  const shiftDays: ShiftDay[] = [];

  const collect = <T extends HourSessionRow>(
    sessions: T[],
    personOf: (r: T) => string,
    targetOf: (personId: string, date: string, storeId: string) => number,
  ) => {
    const byKey = new Map<
      string,
      { person: string; store_id: string; date: string; windows: ShiftDay["windows"] }
    >();
    for (const r of sessions) {
      if (!r.store_id || !r.clock_in_at || !r.clock_out_at) continue;
      const person = personOf(r);
      const key = `${person}|${r.event_date}|${r.store_id}`;
      const entry =
        byKey.get(key) ?? { person, store_id: r.store_id, date: r.event_date, windows: [] };
      entry.windows.push({ start: r.clock_in_at, end: r.clock_out_at });
      byKey.set(key, entry);
    }
    for (const entry of byKey.values()) {
      const target = targetOf(entry.person, entry.date, entry.store_id);
      if (!(target > 0)) continue;
      shiftDays.push({
        store_id: entry.store_id,
        event_date: entry.date,
        windows: entry.windows,
        target_hours: target,
      });
    }
  };

  const approvedByDay = new Map<string, number>();
  for (const r of (dayRes.data ?? []) as Array<{
    employee_id: string;
    store_id: string | null;
    event_date: string;
    approved_hours: number | string | null;
  }>) {
    approvedByDay.set(`${r.employee_id}|${r.event_date}|${r.store_id}`, num(r.approved_hours));
  }
  collect(
    (sessionsRes.data ?? []) as Array<HourSessionRow & { employee_id: string }>,
    (r) => r.employee_id,
    (id, date, storeId) => approvedByDay.get(`${id}|${date}|${storeId}`) ?? 0,
  );

  const mgrHoursByDay = new Map<string, number>();
  for (const r of (mgrDayRes.data ?? []) as Array<{
    manager_id: string;
    store_id: string | null;
    event_date: string;
    worked_hours: number | string | null;
  }>) {
    mgrHoursByDay.set(`${r.manager_id}|${r.event_date}|${r.store_id}`, num(r.worked_hours));
  }
  collect(
    (
      (mgrSessRes.data ?? []) as Array<
        HourSessionRow & { manager_id: string; deliveries_only: boolean }
      >
      // A deliveries-only row sits at 12:00 with zero length — a count, not a
      // shift, and would otherwise land phantom cover at noon.
    ).filter((r) => !r.deliveries_only),
    (r) => r.manager_id,
    (id, date, storeId) => mgrHoursByDay.get(`${id}|${date}|${storeId}`) ?? 0,
  );

  const coverHoursByDay = new Map<string, number>();
  for (const r of (coverHoursRes.data ?? []) as Array<{
    cover_driver_id: string;
    store_id: string | null;
    work_date: string;
    total_hours_worked: number | string | null;
    approved: boolean;
  }>) {
    if (!r.approved) continue;
    coverHoursByDay.set(
      `${r.cover_driver_id}|${r.work_date}|${r.store_id}`,
      num(r.total_hours_worked),
    );
  }
  collect(
    (coverClockRes.data ?? []) as Array<HourSessionRow & { cover_driver_id: string }>,
    (r) => r.cover_driver_id,
    (id, date, storeId) => coverHoursByDay.get(`${id}|${date}|${storeId}`) ?? 0,
  );

  const salesByStore = new Map<string, Map<string, number>>();
  let salesError: string | null = null;
  try {
    for (const r of await getDailyNetSalesByHour(weekStart, weekEnd)) {
      const slug = (r.store_slug ?? "").toLowerCase();
      if (!slug) continue;
      const m = salesByStore.get(slug) ?? new Map<string, number>();
      const key = `${String(r.business_date).slice(0, 10)}|${num(r.hour)}`;
      m.set(key, (m.get(key) ?? 0) + num(r.net_sales));
      salesByStore.set(slug, m);
    }
  } catch (err) {
    salesError = err instanceof Error ? err.message : "hourly net sales unavailable";
  }

  const out: LabourHourGrid[] = [];
  for (const store of stores) {
    const slug = store.vm_store_name ? canonicalStore(store.vm_store_name).toLowerCase() : null;
    const sales = slug ? salesByStore.get(slug) : undefined;
    if (!sales || sales.size === 0) continue;

    // The trading window is whatever the feed actually reports trade in.
    const traded = Array.from(sales.entries())
      .filter(([, v]) => v > 0)
      .map(([k]) => Number(k.slice(k.indexOf("|") + 1)));
    if (traded.length === 0) continue;
    const hours: number[] = [];
    for (let h = Math.min(...traded); h <= Math.max(...traded); h++) hours.push(h);

    const cells: LabourHourCell[][] = hours.map(() =>
      Array.from({ length: 7 }, () => ({ staffed_hours: 0, net_sales: 0 as number | null })),
    );
    const outside = Array.from({ length: 7 }, () => 0);

    for (let day = 0; day < 7; day++) {
      const date = addDaysIso(weekStart, day);
      for (let hi = 0; hi < hours.length; hi++) {
        cells[hi][day].net_sales = sales.get(`${date}|${hours[hi]}`) ?? 0;
      }
    }

    for (const sd of shiftDays) {
      if (sd.store_id !== store.id) continue;
      const day = Math.round(
        (Date.parse(`${sd.event_date}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) /
          (24 * HOUR_MS),
      );
      if (day < 0 || day > 6) continue;

      const perHour = new Map<number, number>();
      let raw = 0;
      for (const w of sd.windows) {
        spreadOverHours(londonWall(w.start), londonWall(w.end), (hour, h) => {
          perHour.set(hour, (perHour.get(hour) ?? 0) + h);
          raw += h;
        });
      }
      if (!(raw > 0)) continue;

      const scale = sd.target_hours / raw;
      for (const [hour, h] of perHour) {
        const hi = hours.indexOf(hour);
        if (hi === -1) outside[day] += h * scale;
        else cells[hi][day].staffed_hours += h * scale;
      }
    }

    let staffed = 0;
    let net = 0;
    for (const row of cells) {
      for (const c of row) {
        staffed += c.staffed_hours;
        net += c.net_sales ?? 0;
      }
    }

    out.push({
      store_id: store.id,
      store: store.name,
      hours,
      cells: cells.map((row) =>
        row.map((c) => ({
          staffed_hours: round2(c.staffed_hours),
          net_sales: c.net_sales == null ? null : round2(c.net_sales),
        })),
      ),
      outside_hours: outside.map(round2),
      splh: staffed > 0 ? round2(net / staffed) : null,
    });
  }

  return { stores: out, load_error: out.length === 0 ? salesError : null };
}

export type LabourSlackWindow = {
  store_id: string;
  from_hour: number;
  to_hour: number;
  staffed_hours: number;
  net_sales: number;
  splh: number;
  /** The store's own weekly average, the figure splh is judged against. */
  splh_benchmark: number;
  /** Paid cost of the hours that could come out and still clear the floor. */
  recoverable: number;
  /** The weekdays inside the run that are worst, worst first. */
  worst_days: string[];
};

/**
 * Contiguous runs of hours where each hour earns less per staffed hour than
 * `floorRatio` of the store's own weekly average.
 *
 * Deliberately measured on the WEEK's total for each hour, not per day-cell.
 * A single store-hour-day holds a handful of orders, and the heat map's own
 * header records that a ratio at that grain was tried and dropped (Update 34)
 * because sampling noise dominated it. The same objection applies to money.
 */
export function findSlackWindows(
  grid: LabourHourGrid,
  blendedRate: number,
  floorRatio: number,
): LabourSlackWindow[] {
  if (grid.splh == null || !(grid.splh > 0)) return [];
  const floor = grid.splh * floorRatio;

  const hourly = grid.hours.map((hour, hi) => {
    const staffed = grid.cells[hi].reduce((t, c) => t + c.staffed_hours, 0);
    const net = grid.cells[hi].reduce((t, c) => t + (c.net_sales ?? 0), 0);
    return { hour, hi, staffed, net, splh: staffed > 0 ? net / staffed : null };
  });

  const windows: LabourSlackWindow[] = [];
  let run: typeof hourly = [];

  const close = () => {
    if (run.length === 0) return;
    const staffed = run.reduce((t, r) => t + r.staffed, 0);
    const net = run.reduce((t, r) => t + r.net, 0);
    const splh = net / staffed;
    // Hours that could come out and still leave the run at the floor rate.
    const recoverable = Math.max(0, staffed - net / floor) * blendedRate;
    const dayTotals = Array.from({ length: 7 }, (_, day) => {
      const s = run.reduce((t, r) => t + grid.cells[r.hi][day].staffed_hours, 0);
      const n = run.reduce((t, r) => t + (grid.cells[r.hi][day].net_sales ?? 0), 0);
      return { day, s, ratio: s > 0 ? n / s : Number.POSITIVE_INFINITY };
    });
    windows.push({
      store_id: grid.store_id,
      from_hour: run[0].hour,
      to_hour: run[run.length - 1].hour + 1,
      staffed_hours: round2(staffed),
      net_sales: round2(net),
      splh: round2(splh),
      splh_benchmark: grid.splh ?? 0,
      recoverable: round2(recoverable),
      worst_days: dayTotals
        .filter((d) => d.s > 0 && d.ratio < floor)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 3)
        .map((d) => WEEKDAYS[d.day]),
    });
    run = [];
  };

  for (const h of hourly) {
    // An hour nobody staffed is not slack, but it does break the run.
    if (h.splh != null && h.staffed > 0 && h.splh < floor) run.push(h);
    else close();
  }
  close();

  return windows.sort((a, b) => b.recoverable - a.recoverable);
}

// =============================================================
// Why labour % moved
// =============================================================

export type LabourBridge = {
  /** Percentage points of the move caused by sales moving. */
  sales_pp: number;
  /** …by the number of hours worked moving. */
  hours_pp: number;
  /** …by the blended cost of an hour moving. */
  rate_pp: number;
  /** The actual change. The three effects sum to it exactly. */
  total_pp: number;
};

/**
 * Split a week-on-week change in labour % into its three causes.
 *
 * Labour % is cost ÷ sales, and cost is hours × the blended rate, so a move can
 * only come from sales, from hours, or from the price of an hour. Separating
 * them is what stops the most common misreading of this page: labour % rising
 * on a quiet week reads as overspending, and the answer "cut hours" is wrong
 * when the rota never moved.
 *
 * Each effect holds the others at one end of the period and the already-counted
 * ones at the other, which is what makes the three sum to the actual change
 * rather than approximately to it.
 */
export function labourBridge(
  prev: { total_cost: number; total_hours: number; net_sales: number | null },
  cur: { total_cost: number; total_hours: number; net_sales: number | null },
): LabourBridge | null {
  const s0 = prev.net_sales;
  const s1 = cur.net_sales;
  if (s0 == null || s1 == null || !(s0 > 0) || !(s1 > 0)) return null;
  if (!(prev.total_hours > 0) || !(cur.total_hours > 0)) return null;

  const r0 = prev.total_cost / prev.total_hours;
  const r1 = cur.total_cost / cur.total_hours;

  const sales_pp = (prev.total_cost / s1 - prev.total_cost / s0) * 100;
  const hours_pp = ((r0 * (cur.total_hours - prev.total_hours)) / s1) * 100;
  const rate_pp = ((cur.total_hours * (r1 - r0)) / s1) * 100;

  return {
    sales_pp: round2(sales_pp),
    hours_pp: round2(hours_pp),
    rate_pp: round2(rate_pp),
    total_pp: round2(sales_pp + hours_pp + rate_pp),
  };
}
