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
import { getExecMulti, getWeekdays } from "@/lib/vm-analytics/queries";
import {
  buildCoverDriverWageLines,
  buildManagerWageLines,
  buildWageLinesForStore,
  cashHoursFromStoreTotal,
  round2,
  type CoverDriverPayRow,
  type ManagerPayee,
  type ManagerPayRow,
  type StoreClockRow,
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
  ] = await Promise.all([
    sb.from("stores").select("id, name, vm_store_name"),
    // Leavers included: someone marked "left" still worked the week being costed.
    sb.from("employees").select("*"),
    sb
      .from("clock_events")
      .select(
        "employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, hours_approved, approved_hours, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
      )
      .gte("event_date", rangeStart)
      .lte("event_date", rangeEnd),
    sb
      .from("cover_driver_hours_computed")
      .select(
        "cover_driver_id, driver_name, store_id, work_date, total_hours_worked, hourly_rate_snapshot, short_deliveries, long_deliveries, extra_short_deliveries, extra_long_deliveries, short_rate_snapshot, long_rate_snapshot, approved",
      )
      .gte("work_date", rangeStart)
      .lte("work_date", rangeEnd),
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
      .gte("event_date", rangeStart)
      .lte("event_date", rangeEnd),
    sb
      .from("rota_shifts")
      .select("store_id, shift_date, scheduled_hours, is_day_off")
      .gte("shift_date", rangeStart)
      .lte("shift_date", rangeEnd),
    sb
      .from("daily_cash_entries")
      .select("store_id, entry_date, vita_mojo_sales")
      .gte("entry_date", rangeStart)
      .lte("entry_date", rangeEnd),
  ]);

  const loadError =
    storesRes.error?.message ??
    employeesRes.error?.message ??
    clocksRes.error?.message ??
    coverRes.error?.message ??
    managersRes.error?.message ??
    managerClocksRes.error?.message ??
    rotaRes.error?.message ??
    cashRes.error?.message ??
    null;
  if (loadError) {
    return { rows: [], load_error: `Couldn't read the week's hours: ${loadError}` };
  }

  const stores = (storesRes.data ?? []) as StoreRow[];
  const employees = (employeesRes.data ?? []) as Employee[];
  const clocks = (clocksRes.data ?? []) as StoreClockRow[];
  const cover = (coverRes.data ?? []) as CoverRow[];
  const managers = (managersRes.data ?? []) as ManagerRow[];
  const managerClocks = (managerClocksRes.data ?? []) as ManagerClockRow[];
  const rota = (rotaRes.data ?? []) as RotaRow[];
  const cashEntries = (cashRes.data ?? []) as CashEntryRow[];

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
        buildWageLinesForStore(storeId, employees, weekClocks).map((l) => [
          l.employee_id,
          l,
        ]),
      );

      for (const emp of employees) {
        const hoursAtStore = round2(
          weekClocks
            .filter(
              (c) => c.employee_id === emp.id && c.store_id === storeId && c.clock_in_at,
            )
            .reduce((t, c) => t + num(c.approved_hours), 0),
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
  /** Scaled from the weekday sales SHAPE to the week's net total — see below. */
  net_sales: number | null;
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
 * Hours come from `clock_events.approved_hours` — the per-day sum of that day
 * signed-off `clock_sessions`, which is what every other payroll screen pays
 * from. Reading the sessions directly would have to re-derive that sum and
 * could pick up shifts nobody has approved.
 */
export async function getLabourWeekdayBreakdown(
  weekStart: string,
): Promise<{ stores: LabourWeekdayStore[]; load_error: string | null }> {
  const weekEnd = weekEndOf(weekStart);
  const sb = getCashflowSupabaseServer();

  const [storesRes, employeesRes, clocksRes, coverRes, managersRes, managerClocksRes] =
    await Promise.all([
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
    ]);

  const loadError =
    storesRes.error?.message ??
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
  const managerById = new Map(managers.map((m) => [m.id, m]));
  const empById = new Map(employees.map((e) => [e.id, e]));

  // The weekday view carries GROSS revenue, so it is used only as the SHAPE and
  // scaled to the week VM net total — the same treatment the Daypart dashboard
  // gives it. Mixing gross days into a net labour % would read low.
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

    const storeDays = clocks
      .filter((c) => c.store_id === storeId && c.clock_in_at && num(c.approved_hours) > 0)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    for (const c of storeDays) {
      const emp = empById.get(c.employee_id);
      if (!emp) continue;
      const hours = num(c.approved_hours);
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

    const days: LabourDayRow[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysIso(weekStart, i);
      // vm_v_daypart_weekday numbers Monday as 1.
      const shapeShare = shape?.get(i + 1) ?? 0;
      const netSales =
        weekNet != null && shapeTotal > 0 ? round2((shapeShare / shapeTotal) * weekNet) : null;
      const hours = round2(dayHours.get(date) ?? 0);
      const cost = round2(dayCost.get(date) ?? 0);
      days.push({
        weekday_id: i + 1,
        weekday: WEEKDAYS[i],
        net_sales: netSales,
        hours,
        cost,
        labour_pct: netSales != null && netSales > 0 ? round2((cost / netSales) * 100) : null,
        splh: hours > 0 && netSales != null ? round2(netSales / hours) : null,
      });
    }

    out.push({ store_id: storeId, store: store.name, vm_store_name: store.vm_store_name, days });
  }

  return { stores: out, load_error: weekdayError };
}
