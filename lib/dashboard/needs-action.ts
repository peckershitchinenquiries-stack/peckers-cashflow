import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISODate, toISODate } from "@/lib/utils";
import type {
  DashboardStore,
  DashboardWeeks,
  LastWeekPerformance,
  NeedsActionData,
  PayoutCardData,
} from "./types";

type Dated = { store_id: string | null; date: string; key: string };

/** Raw rows for every store at once; split per store by buildNeedsAction. */
export type NeedsActionRows = {
  since: string;
  unapproved: Dated[] | null;
  cashEntries: { store_id: string; entry_date: string; reason: string | null }[] | null;
  alertCounts: Map<string, number>;
  unassignedAlerts: number | null;
  errors: { label: string; message: string; storeId?: string }[];
};

export async function loadNeedsActionRows(
  supabase: SupabaseClient,
  stores: DashboardStore[],
  weeks: DashboardWeeks,
  since: string,
): Promise<NeedsActionRows> {
  const [emp, mgr, cdEvents, cdApproved, cash, alerts, unassigned] =
    await Promise.all([
      supabase
        .from("clock_sessions")
        .select("employee_id, store_id, event_date")
        .gte("event_date", since)
        .lte("event_date", weeks.today)
        .not("clock_out_at", "is", null)
        .eq("hours_approved", false),
      supabase
        .from("manager_clock_sessions")
        .select("manager_id, store_id, event_date")
        .gte("event_date", since)
        .lte("event_date", weeks.today)
        .not("clock_out_at", "is", null)
        .eq("deliveries_approved", false),
      supabase
        .from("cover_driver_clock_events")
        .select("cover_driver_id, store_id, event_date")
        .gte("event_date", since)
        .lte("event_date", weeks.today)
        .not("clock_out_at", "is", null),
      supabase
        .from("cover_driver_hours")
        .select("cover_driver_id, work_date")
        .gte("work_date", since)
        .lte("work_date", weeks.today)
        .eq("approved", true),
      supabase
        .from("daily_cash_entries")
        .select("store_id, entry_date, reason")
        .gte("entry_date", since)
        .lte("entry_date", weeks.yesterday),
      Promise.all(
        stores.map((s) =>
          supabase
            .from("alerts")
            .select("id", { count: "exact", head: true })
            .eq("resolved", false)
            .eq("store_id", s.id),
        ),
      ),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false)
        .is("store_id", null),
    ]);

  const errors: NeedsActionRows["errors"] = [];
  const fail = (label: string, error: { message: string } | null) => {
    if (error) errors.push({ label, message: error.message });
    return Boolean(error);
  };

  const approvalFailed = [
    fail("Employee approvals", emp.error),
    fail("Manager approvals", mgr.error),
    fail("Cover driver shifts", cdEvents.error),
    fail("Cover driver approvals", cdApproved.error),
  ].some(Boolean);

  let unapproved: Dated[] | null = null;
  if (!approvalFailed) {
    const approvedCd = new Set(
      (cdApproved.data ?? []).map((r) => `${r.cover_driver_id}:${r.work_date}`),
    );
    unapproved = [
      ...(emp.data ?? []).map((r) => ({
        store_id: r.store_id,
        date: r.event_date,
        key: `emp:${r.employee_id}:${r.event_date}`,
      })),
      ...(mgr.data ?? []).map((r) => ({
        store_id: r.store_id,
        date: r.event_date,
        key: `mgr:${r.manager_id}:${r.event_date}`,
      })),
      ...(cdEvents.data ?? [])
        .filter((r) => !approvedCd.has(`${r.cover_driver_id}:${r.event_date}`))
        .map((r) => ({
          store_id: r.store_id,
          date: r.event_date,
          key: `cd:${r.cover_driver_id}:${r.event_date}`,
        })),
    ];
  }

  const cashFailed = fail("Daily cash entries", cash.error);

  const alertCounts = new Map<string, number>();
  alerts.forEach((res, i) => {
    if (res.error) {
      errors.push({ label: "Open alerts", message: res.error.message, storeId: stores[i].id });
    } else {
      alertCounts.set(stores[i].id, res.count ?? 0);
    }
  });
  fail("Open alerts", unassigned.error);

  return {
    since,
    unapproved,
    cashEntries: cashFailed ? null : cash.data ?? [],
    alertCounts,
    unassignedAlerts: unassigned.error ? null : unassigned.count ?? 0,
    errors,
  };
}

function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parseISODate(start); toISODate(d) <= end; d = addDays(d, 1)) out.push(toISODate(d));
  return out;
}

export function buildNeedsAction(
  store: DashboardStore,
  rows: NeedsActionRows,
  weeks: DashboardWeeks,
  performance: LastWeekPerformance,
  thisTuesday: PayoutCardData,
): NeedsActionData {
  const errors = rows.errors
    .filter((e) => !e.storeId || e.storeId === store.id)
    .map((e) => `${e.label}: ${e.message}`);

  const storeUnapproved = rows.unapproved?.filter((r) => r.store_id === store.id) ?? null;
  const distinct = (list: { key: string }[]) => new Set(list.map((r) => r.key)).size;

  const storeEntries = rows.cashEntries?.filter((e) => e.store_id === store.id) ?? null;
  const entered = new Set(storeEntries?.map((e) => e.entry_date));

  const storeAlerts = rows.alertCounts.get(store.id);
  const pnl = performance.pnl;
  const labourOver =
    pnl && pnl.labourBudgetPct > 0 && performance.grossSales > 0 && pnl.labourVariancePct < 0
      ? -pnl.labourVariancePct * 100
      : null;

  return {
    errors,
    approvalSince: rows.since,
    unapprovedDays: storeUnapproved ? distinct(storeUnapproved) : null,
    missingCashDates: storeEntries
      ? rows.since <= weeks.yesterday
        ? datesBetween(rows.since, weeks.yesterday).filter((d) => !entered.has(d))
        : []
      : null,
    changedEnvelopeDates: storeEntries
      ? [
          ...new Set(
            storeEntries.filter((e) => (e.reason ?? "").trim() !== "").map((e) => e.entry_date),
          ),
        ].sort()
      : null,
    unpaidOnConfirmedSheet:
      thisTuesday.state === "confirmed" && storeUnapproved
        ? distinct(
            storeUnapproved.filter(
              (r) => r.date >= thisTuesday.payWeek.start && r.date <= thisTuesday.payWeek.end,
            ),
          )
        : 0,
    reportNotLocked: performance.status === null || performance.status === "draft",
    labourOverPts: labourOver,
    openAlerts:
      storeAlerts === undefined || rows.unassignedAlerts === null
        ? null
        : storeAlerts + rows.unassignedAlerts,
    reportHref: performance.reportHref,
    labourHref: performance.labourHref,
  };
}
