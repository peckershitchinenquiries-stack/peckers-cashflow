import {
  getExec,
  getExecChannels,
  getExecMulti,
  getExecChannelsMulti,
  getWeeks,
  getYoy,
  getYoyMulti,
  sumYoyRows,
  yoyWeekIso,
} from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import { shortStore, STORES, resolveStore } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { ExecRow, ExecChannelRow, YoyRow, ExecMode } from "@/lib/vm-analytics/types";
import type { ExecInput } from "@/lib/vm-analytics/insights";
import { share, buildBreakdown, ownDelivery, aggregator, type Breakdown, type GroupAgg } from "@/lib/vm-analytics/channels";

export const dynamic = "force-dynamic";

// Per-week averaging for the 4/12-week views. Only EXTENSIVE quantities (money
// totals and counts that accumulate week over week) are divided by the week
// count; ratios (AOV, %s) are left untouched — a ratio of two averaged
// quantities equals the ratio of the totals, so they are already correct.
function averageGroup(g: GroupAgg, count: number): GroupAgg {
  return {
    ...g,
    netSales: g.netSales / count,
    orders: g.orders / count,
    channels: g.channels.map((c) => ({ ...c, netSales: c.netSales / count, orders: c.orders / count })),
  };
}

function averageBreakdown(b: Breakdown, count: number): Breakdown {
  if (count <= 1) return b; // single-week: return the raw breakdown untouched
  return {
    ...b,
    netSales: b.netSales / count,
    customers: b.customers / count,
    orders: b.orders / count,
    delivery: averageGroup(b.delivery, count),
    inStore: averageGroup(b.inStore, count),
  };
}

// Stand-in comparison group when no prior period exists, so buildChannelTable
// always receives a well-formed GroupAgg. Every prevNet lookup returns 0, which
// the `prevNet > 0` guard turns into a null delta.
const EMPTY_GROUP: GroupAgg = { netSales: 0, orders: 0, aov: 0, channels: [] };

function averageYoyRow(y: YoyRow, count: number): YoyRow {
  if (count <= 1) return y;
  const div = (v: unknown) => n(v) / count;
  return {
    ...y,
    total_sales: div(y.total_sales),
    delivery_sales: div(y.delivery_sales),
    in_store_sales: div(y.in_store_sales),
    own_delivery_sales: div(y.own_delivery_sales),
    aggregate_sales: div(y.aggregate_sales),
    total_orders: div(y.total_orders),
    total_customers: div(y.total_customers),
    new_customers: div(y.new_customers),
    return_customers: div(y.return_customers),
    own_delivery: div(y.own_delivery),
    deliveroo: div(y.deliveroo),
    just_eat: div(y.just_eat),
    uber_eats: div(y.uber_eats),
    click_collect: div(y.click_collect),
    kiosk: div(y.kiosk),
    till_eat_in: div(y.till_eat_in),
    till_takeaway: div(y.till_takeaway),
  };
}

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string; mode?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const activeStores: readonly string[] = activeStore ? [activeStore] : STORES;

  const mode: ExecMode =
    searchParams.mode === "4w" ? "4w" : searchParams.mode === "12w" ? "12w" : "week";
  const isMulti = mode !== "week";
  const periodWeekCount = mode === "12w" ? 12 : 4;

  let weekIso: string | null;
  let rows: ExecRow[];
  let chanRows: ExecChannelRow[];
  let prevRows: ExecRow[] = [];
  let prevChanRows: ExecChannelRow[] = [];
  let weekEnd = "";
  let yoyRow: YoyRow | null = null;
  let yoyWeek = "";
  // Multi-week period metadata (unused in single-week mode).
  let periodLabel = "";
  let periodMatched = 0;
  let periodRequested = 0;
  let yoyMatched = 0;
  let yoyRequested = 0;
  // The N weeks immediately before the current period (multi-week mode only).
  let priorExec: ExecRow[] = [];
  let priorChan: ExecChannelRow[] = [];
  let priorMatched = 0;
  try {
    // One getWeeks() call, then fan out all data fetches in parallel. Keeping the
    // render short reduces event-loop contention (and the chance the concurrent
    // auth fetch in middleware trips its dev-mode timeout).
    const weeks = await getWeeks();

    if (!isMulti) {
      // ── Single week: unchanged behaviour ────────────────────────────────────
      weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
      if (!weekIso) return <EmptyWeek />;
      weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";

      const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
      const prevIso = idx >= 0 ? weeks[idx + 1]?.week_start_iso ?? null : null;
      yoyWeek = yoyWeekIso(weekIso);

      [rows, chanRows, prevRows, prevChanRows, yoyRow] = await Promise.all([
        getExec(weekIso),
        getExecChannels(weekIso),
        prevIso ? getExec(prevIso) : Promise.resolve<ExecRow[]>([]),
        prevIso ? getExecChannels(prevIso) : Promise.resolve<ExecChannelRow[]>([]),
        getYoy(weekIso, activeStore),
      ]);
    } else {
      // ── 4/12-week: aggregate latest N weeks vs same N weeks last year ───────
      // `weeks` is newest-first and excludes the in-progress week, so slice(0, N)
      // is the current period and slice(N, 2N) the N weeks immediately before it,
      // with no gap. Slicing the already-fetched array (rather than calling
      // getLatestWeeks) avoids a second getWeeks() round-trip and guarantees both
      // periods come from one consistent snapshot.
      const periodWeeks = weeks.slice(0, periodWeekCount);
      const priorWeeks = weeks.slice(periodWeekCount, periodWeekCount * 2);
      periodRequested = periodWeekCount;
      periodMatched = periodWeeks.length;
      priorMatched = priorWeeks.length;
      const isoList = periodWeeks.map((w) => w.week_start_iso);
      const priorIsoList = priorWeeks.map((w) => w.week_start_iso);

      if (periodWeeks.length > 0) {
        const oldest = periodWeeks[periodWeeks.length - 1];
        const newest = periodWeeks[0];
        weekIso = newest.week_start_iso; // representative (kept for typing/insights)
        weekEnd = newest.week_end;
        periodLabel = weekRange(oldest.week_start, newest.week_end);
      } else {
        weekIso = null;
      }
      yoyWeek = `same ${periodWeekCount} wks`;

      const [execMulti, chanMulti, yoy, priorExecMulti, priorChanMulti] = await Promise.all([
        getExecMulti(isoList),
        getExecChannelsMulti(isoList),
        getYoyMulti(isoList, activeStore),
        priorIsoList.length ? getExecMulti(priorIsoList) : Promise.resolve<ExecRow[]>([]),
        priorIsoList.length
          ? getExecChannelsMulti(priorIsoList)
          : Promise.resolve<ExecChannelRow[]>([]),
      ]);
      rows = execMulti;
      chanRows = chanMulti;
      priorExec = priorExecMulti;
      priorChan = priorChanMulti;
      prevRows = []; // no "previous week" in multi-week mode
      prevChanRows = [];
      yoyMatched = yoy.matched;
      yoyRequested = yoy.requested;
      yoyRow = yoy.matched > 0 ? sumYoyRows(yoy.rows) : null;
    }
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Executive Dashboard" />
        <EmptyWeek />
      </>
    );
  }

  const scopeLabel = activeStore ? shortStore(activeStore) : "Both stores combined";

  // Header subtitle: a single week range, or the aggregated period with any
  // partial-data notes (current-year weeks synced, prior-year weeks matched).
  let subtitle: string;
  if (isMulti) {
    const notes: string[] = [];
    if (periodMatched < periodRequested) notes.push(`${periodMatched} of ${periodRequested} weeks synced`);
    if (priorMatched < periodWeekCount) notes.push(`prior period: ${priorMatched} of ${periodWeekCount} weeks`);
    if (yoyMatched < yoyRequested) notes.push(`prior-year: ${yoyMatched} of ${yoyRequested} weeks matched`);
    subtitle =
      `${scopeLabel} · Latest ${periodWeekCount} weeks (${periodLabel})` +
      (notes.length ? ` · ${notes.join(" · ")}` : "");
  } else {
    subtitle = `${scopeLabel} · ${weekRange(weekIso, weekEnd)}`;
  }

  // Breakdowns: one per active store, plus the combined scope and prev week.
  // In 4/12-week mode every extensive figure is shown as a per-week average.
  // Each period is divided by the number of weeks it ACTUALLY contains — not the
  // number requested — so a partially-synced period is not understated, and so a
  // short prior period stays comparable to a full current one.
  const avgN = isMulti ? Math.max(periodMatched, 1) : 1;
  const priorAvgN = Math.max(priorMatched, 1);
  const byStore = new Map<string, Breakdown>();
  for (const s of activeStores) byStore.set(s, averageBreakdown(buildBreakdown([s], rows, chanRows), avgN));
  const combined = averageBreakdown(buildBreakdown(activeStores, rows, chanRows), avgN);
  // Prior period (multi-week only): same construction, its own divisor.
  const hasPriorPeriod = isMulti && priorMatched > 0 && priorExec.length > 0;
  const priorCombined = hasPriorPeriod
    ? averageBreakdown(buildBreakdown(activeStores, priorExec, priorChan), priorAvgN)
    : null;
  if (isMulti && yoyRow) yoyRow = averageYoyRow(yoyRow, periodWeekCount);
  const hasPrev = prevRows.length > 0;
  const prevCombined = buildBreakdown(activeStores, prevRows, prevChanRows);
  const prevByStore = new Map<string, Breakdown>();
  if (hasPrev) {
    for (const s of activeStores) prevByStore.set(s, buildBreakdown([s], prevRows, prevChanRows));
  }

  // ---- Headline WoW deltas (scoped to the selected store/s)
  const netWow = hasPrev ? share(combined.netSales - prevCombined.netSales, prevCombined.netSales) : null;
  const ordWow = hasPrev ? share(combined.orders - prevCombined.orders, prevCombined.orders) : null;
  const custWow = hasPrev ? share(combined.customers - prevCombined.customers, prevCombined.customers) : null;
  const netDelWow = hasPrev
    ? share(combined.delivery.netSales - prevCombined.delivery.netSales, prevCombined.delivery.netSales)
    : null;
  const netInWow = hasPrev
    ? share(combined.inStore.netSales - prevCombined.inStore.netSales, prevCombined.inStore.netSales)
    : null;
  const aovBlendWow =
    hasPrev && prevCombined.aov > 0 ? share(combined.aov - prevCombined.aov, prevCombined.aov) : null;

  // ---- Prior-period deltas (4/12-week modes) -----------------------------
  // Current period vs the N weeks immediately before it. Both sides are
  // per-week averages (each divided by its own week count), so the comparison
  // holds even when the prior period is short.
  const priorDelta = (cur: number, prior: number): number | null =>
    priorCombined && prior > 0 ? share(cur - prior, prior) : null;

  const netPrior = priorDelta(combined.netSales, priorCombined?.netSales ?? 0);
  const netDelPrior = priorDelta(combined.delivery.netSales, priorCombined?.delivery.netSales ?? 0);
  const netInPrior = priorDelta(combined.inStore.netSales, priorCombined?.inStore.netSales ?? 0);
  const ordPrior = priorDelta(combined.orders, priorCombined?.orders ?? 0);
  const custPrior = priorDelta(combined.customers, priorCombined?.customers ?? 0);
  const aovBlendPrior = priorDelta(combined.aov, priorCombined?.aov ?? 0);

  const priorLabel = `vs prev ${periodWeekCount}w`;
  const priorTitle = `Versus the preceding ${periodWeekCount} weeks`;

  // ---- YoY deltas (from historical Excel data) ----------------------------
  // Own Delivery / Aggregator YoY is no longer computed here — the KPI Summary
  // table derives those rows from their own `yoyVal` accessors.
  const hasYoy = yoyRow !== null;
  const yoyTotalSales    = yoyRow ? n(yoyRow.total_sales)         : 0;
  const yoyDeliverySales = yoyRow ? n(yoyRow.delivery_sales)      : 0;
  const yoyInStoreSales  = yoyRow ? n(yoyRow.in_store_sales)      : 0;

  const netYoy    = hasYoy && yoyTotalSales    > 0 ? share(combined.netSales           - yoyTotalSales,    yoyTotalSales)    : null;
  const delYoy    = hasYoy && yoyDeliverySales > 0 ? share(combined.delivery.netSales  - yoyDeliverySales, yoyDeliverySales) : null;
  const inStYoy   = hasYoy && yoyInStoreSales  > 0 ? share(combined.inStore.netSales   - yoyInStoreSales,  yoyInStoreSales)  : null;

  // YoY deltas for orders and customers (from EPOS data)
  // Order count uses the same base as the KPI Summary table's YoY cell: total
  // orders, falling back to summed channel counts when total_orders is 0. The
  // card now prints this figure next to its %, so the two must share a base.
  const yoyTotalOrdersEff = yoyRow
    ? n(yoyRow.total_orders) ||
      (n(yoyRow.own_delivery) + n(yoyRow.deliveroo) + n(yoyRow.just_eat) + n(yoyRow.uber_eats) +
        n(yoyRow.click_collect) + n(yoyRow.kiosk) + n(yoyRow.till_eat_in) + n(yoyRow.till_takeaway))
    : 0;
  const yoyTotalCustomers = yoyRow ? n(yoyRow.total_customers)  : 0;

  const ordYoy  = hasYoy && yoyTotalOrdersEff > 0 ? share(combined.orders     - yoyTotalOrdersEff, yoyTotalOrdersEff) : null;
  const custYoy = hasYoy && yoyTotalCustomers > 0 ? share(combined.customers  - yoyTotalCustomers, yoyTotalCustomers) : null;

  const yoyAovBlend = yoyTotalOrdersEff > 0 && yoyTotalSales > 0 ? yoyTotalSales / yoyTotalOrdersEff : 0;
  const aovBlendYoy = hasYoy && yoyAovBlend > 0 ? share(combined.aov - yoyAovBlend, yoyAovBlend) : null;

  // Delivery % / In-store % — share of net sales, with WoW (vs previous week's
  // share) and YoY (vs same week last year's sales-based share).
  const deliveryPct = share(combined.delivery.netSales, combined.netSales);
  const inStorePct = share(combined.inStore.netSales, combined.netSales);
  const prevDeliveryPct = share(prevCombined.delivery.netSales, prevCombined.netSales);
  const prevInStorePct = share(prevCombined.inStore.netSales, prevCombined.netSales);
  const yoyDeliveryPct = yoyTotalSales > 0 ? share(yoyDeliverySales, yoyTotalSales) : 0;
  const yoyInStorePct = yoyTotalSales > 0 ? share(yoyInStoreSales, yoyTotalSales) : 0;

  const deliveryPctWow = hasPrev && prevDeliveryPct > 0 ? share(deliveryPct - prevDeliveryPct, prevDeliveryPct) : null;
  const inStorePctWow = hasPrev && prevInStorePct > 0 ? share(inStorePct - prevInStorePct, prevInStorePct) : null;
  const deliveryPctYoy = hasYoy && yoyDeliveryPct > 0 ? share(deliveryPct - yoyDeliveryPct, yoyDeliveryPct) : null;
  const inStorePctYoy = hasYoy && yoyInStorePct > 0 ? share(inStorePct - yoyInStorePct, yoyInStorePct) : null;

  // Prior-period share deltas. Expressed as a RELATIVE change of the share —
  // the same basis as the YoY badge sitting next to them — so the two are read
  // on the same scale. Percentage-point change would need both to move together.
  const priorDeliveryPct = priorCombined
    ? share(priorCombined.delivery.netSales, priorCombined.netSales)
    : 0;
  const priorInStorePct = priorCombined
    ? share(priorCombined.inStore.netSales, priorCombined.netSales)
    : 0;
  const deliveryPctPrior = priorDelta(deliveryPct, priorDeliveryPct);
  const inStorePctPrior = priorDelta(inStorePct, priorInStorePct);

  // ---- KPI Summary table (per store) -------------------------------------
  type KpiRowDef = {
    kpi: string;
    indent?: boolean;
    // Semantic colour: "good" (green) for in-store / own delivery, "bad" (red)
    // for aggregator. Drives the value colour in every store column.
    tone?: "good" | "bad";
    // Primary numeric behind the row, plus how to render it. Every row defines
    // both, so the comparison columns can colour themselves by direction even on
    // rows that do not display a bracketed percentage.
    val: (b: Breakdown) => number;
    fmt: (v: number) => string;
    // Prior-year figure for this row, on the best available basis. Null when the
    // historical data cannot support the metric.
    yoyVal: (y: YoyRow) => number | null;
    // Whether the bracketed % appears in the comparison column. Per the dashboard
    // standard this is the five Net Sales rows only.
    showDelta?: boolean;
  };

  // Prior-year order counts, with the summed-channel fallback used whenever
  // total_orders is absent. Shared by every yoyVal accessor below.
  const yoyOrderCounts = (y: YoyRow) => {
    const own = n(y.own_delivery);
    const agg = n(y.deliveroo) + n(y.just_eat) + n(y.uber_eats);
    const inStore = n(y.click_collect) + n(y.kiosk) + n(y.till_eat_in) + n(y.till_takeaway);
    return { own, agg, delivery: own + agg, inStore, total: n(y.total_orders) || own + agg + inStore };
  };

  // Sales ÷ orders, or null when either side is missing — the AOV rows' basis.
  const yoyAov = (sales: number, orders: number): number | null =>
    orders > 0 && sales > 0 ? sales / orders : null;

  const positive = (v: number): number | null => (v > 0 ? v : null);

  const kpiRows: KpiRowDef[] = [
    { kpi: "Net Sales", fmt: gbp, val: (b) => b.netSales, yoyVal: (y) => n(y.total_sales), showDelta: true },
    { kpi: "Net Sales — Delivery", fmt: gbp, val: (b) => b.delivery.netSales, yoyVal: (y) => n(y.delivery_sales), showDelta: true },
    { kpi: "Net Sales — Own Delivery", indent: true, tone: "good", fmt: gbp, val: (b) => ownDelivery(b.delivery).netSales, yoyVal: (y) => n(y.own_delivery_sales), showDelta: true },
    { kpi: "Net Sales — Aggregator", indent: true, tone: "bad", fmt: gbp, val: (b) => aggregator(b.delivery).netSales, yoyVal: (y) => n(y.aggregate_sales), showDelta: true },
    { kpi: "Net Sales — In-store", tone: "good", fmt: gbp, val: (b) => b.inStore.netSales, yoyVal: (y) => n(y.in_store_sales), showDelta: true },
    { kpi: "Total Orders", fmt: int, val: (b) => b.orders, yoyVal: (y) => positive(yoyOrderCounts(y).total) },
    { kpi: "Customers", fmt: int, val: (b) => b.customers, yoyVal: (y) => positive(n(y.total_customers)) },
    { kpi: "AOV (Blended)", fmt: gbp, val: (b) => b.aov, yoyVal: (y) => yoyAov(n(y.total_sales), yoyOrderCounts(y).total) },
    { kpi: "AOV — Delivery", fmt: gbp, val: (b) => b.delivery.aov, yoyVal: (y) => yoyAov(n(y.delivery_sales), yoyOrderCounts(y).delivery) },
    { kpi: "AOV — Own Delivery", indent: true, tone: "good", fmt: gbp, val: (b) => ownDelivery(b.delivery).aov, yoyVal: (y) => yoyAov(n(y.own_delivery_sales), yoyOrderCounts(y).own) },
    { kpi: "AOV — Aggregator", indent: true, tone: "bad", fmt: gbp, val: (b) => aggregator(b.delivery).aov, yoyVal: (y) => yoyAov(n(y.aggregate_sales), yoyOrderCounts(y).agg) },
    { kpi: "AOV — In-store", tone: "good", fmt: gbp, val: (b) => b.inStore.aov, yoyVal: (y) => yoyAov(n(y.in_store_sales), yoyOrderCounts(y).inStore) },
  ];

  const cellOf = (r: KpiRowDef, b: Breakdown) => r.fmt(r.val(b));

  // Green for margin-friendly rows (in-store / own delivery), red for aggregator.
  const toneClass = (tone?: "good" | "bad") =>
    tone === "good"
      ? "text-success"
      : tone === "bad"
      ? "text-danger"
      : "";

  // Direction of travel for a comparison column: green when the current value is
  // above the comparison, red when below, grey when there is nothing to compare.
  // Returned as a % so the same number can also drive the bracketed delta.
  const rowDelta = (r: KpiRowDef, base: number | null): number | null =>
    base !== null && base > 0 ? share(r.val(combined) - base, base) : null;

  const summaryColumns: Column<KpiRowDef>[] = [
    {
      key: "kpi",
      header: "KPI",
      render: (r) => (
        <span className={r.indent ? "pl-4 text-secondary" : "font-medium"}>{r.kpi}</span>
      ),
    },
    ...activeStores.map((s) => ({
      key: shortStore(s).toLowerCase(),
      header: shortStore(s),
      align: "right" as const,
      render: (r: KpiRowDef) => <span className={toneClass(r.tone)}>{cellOf(r, byStore.get(s)!)}</span>,
    })),
    // Total column only adds information when more than one store is shown.
    ...(activeStores.length > 1
      ? [
          {
            key: "total",
            header: "Total",
            align: "right" as const,
            render: (r: KpiRowDef) => (
              <span className={`font-semibold ${toneClass(r.tone)}`}>{cellOf(r, combined)}</span>
            ),
          },
        ]
      : []),
    // Comparison column: "Previous Week" in single-week mode, "Previous N Weeks"
    // in 4/12-week mode. The value is coloured by direction of travel on every
    // row; the bracketed % is still restricted to the five Net Sales rows, per
    // the dashboard standard in CLAUDE.md.
    ...(isMulti
      ? hasPriorPeriod
        ? [
            {
              key: "prior",
              header: `Previous ${periodWeekCount} Weeks`,
              align: "right" as const,
              render: (r: KpiRowDef) => {
                const base = priorCombined ? r.val(priorCombined) : null;
                const pct = rowDelta(r, base);
                return (
                  <span className={pct === null ? "text-tertiary" : deltaClass(pct)}>
                    {priorCombined ? cellOf(r, priorCombined) : "—"}
                    {r.showDelta && pct !== null && (
                      <span className="ml-1 text-xs font-medium">({signedPct(pct)})</span>
                    )}
                  </span>
                );
              },
            },
          ]
        : []
      : [
          {
            key: "prev",
            header: "Previous Week",
            align: "right" as const,
            render: (r: KpiRowDef) => {
              const pct = hasPrev ? rowDelta(r, r.val(prevCombined)) : null;
              return (
                <span className={pct === null ? "text-tertiary" : deltaClass(pct)}>
                  {hasPrev ? cellOf(r, prevCombined) : "—"}
                  {r.showDelta && pct !== null && (
                    <span className="ml-1 text-xs font-medium">({signedPct(pct)})</span>
                  )}
                </span>
              );
            },
          },
        ]),
    {
      key: "yoy",
      header: isMulti ? `Prev Year (${yoyWeek})` : `YoY (${yoyWeek})`,
      align: "right" as const,
      render: (r: KpiRowDef) => {
        const base = yoyRow ? r.yoyVal(yoyRow) : null;
        const pct = rowDelta(r, base);
        return (
          <span className={`text-sm ${pct === null ? "text-text-muted" : deltaClass(pct)}`}>
            {base !== null ? r.fmt(base) : "—"}
            {r.showDelta && pct !== null && (
              <span className="ml-1 text-xs font-medium">({signedPct(pct)})</span>
            )}
          </span>
        );
      },
    },
  ];

  // ---- Order-mix tables (per channel, within each group) -----------------
  // The single home for the per-channel breakdown: orders, net sales, each
  // channel's share of the scope's TOTAL net sales (so the TOTAL row reconciles
  // with the Delivery % / In-store % cards), plus WoW and YoY.
  interface ChannelRow {
    channel: string;
    orders: number;
    netSales: number;
    aov: number;
    pctRevenue: number; // channel net sales ÷ scope total net sales (truncated by pct)
    wow: number | null; // vs previous week's channel net sales (null in multi-week)
    wowBase: number | null; // the comparison period's own net sales, printed beside wow
    yoy: number | null; // vs prior year (see channelYoyInfo for the basis)
    yoyBase: number | null; // the prior-year figure the yoy % was measured against
    yoyBaseIsOrders: boolean; // true when yoyBase is an order count, not net sales
    isTotal?: boolean;
  }

  // Per-channel YoY is order-count based — historical net sales exist only at the
  // group (Delivery/In-store TOTAL) and Own Delivery level, not per aggregator or
  // in-store channel. Mirrors getYoyNumber's best-available basis. Returns the
  // base alongside the % so the table can print the two together.
  type YoyInfo = { pct: number | null; base: number | null; isOrders: boolean };
  const NO_YOY: YoyInfo = { pct: null, base: null, isOrders: false };

  const channelYoyInfo = (
    channel: string,
    groupName: "delivery" | "inStore",
    netSales: number,
    orders: number,
    isTotal: boolean,
    yoy: YoyRow | null
  ): YoyInfo => {
    if (!yoy) return NO_YOY;
    if (isTotal) {
      const base = groupName === "delivery" ? n(yoy.delivery_sales) : n(yoy.in_store_sales);
      return base > 0 ? { pct: share(netSales - base, base), base, isOrders: false } : NO_YOY;
    }
    if (/own|direct/i.test(channel)) {
      const base = n(yoy.own_delivery_sales);
      return base > 0 ? { pct: share(netSales - base, base), base, isOrders: false } : NO_YOY;
    }
    const yoyOrders: Record<string, number> = {
      Deliveroo: n(yoy.deliveroo),
      "Uber Eats": n(yoy.uber_eats),
      "Just Eat": n(yoy.just_eat),
      "Click & Collect": n(yoy.click_collect),
      Kiosk: n(yoy.kiosk),
      "Till (takeaway)": n(yoy.till_takeaway),
      "Till (eat-in)": n(yoy.till_eat_in),
    };
    const base = yoyOrders[channel];
    return base && base > 0
      ? { pct: share(orders - base, base), base, isOrders: true }
      : NO_YOY;
  };

  const buildChannelTable = (
    group: GroupAgg,
    prevGroup: GroupAgg,
    groupName: "delivery" | "inStore",
    yoy: YoyRow | null
  ): ChannelRow[] => {
    const scopeTotal = combined.netSales;
    const row = (
      channel: string,
      netSales: number,
      orders: number,
      aov: number,
      isTotal: boolean
    ): ChannelRow => {
      const prevNet = isTotal
        ? prevGroup.netSales
        : prevGroup.channels.find((c) => c.channel === channel)?.netSales ?? 0;
      // Single-week: vs previous week. Multi-week: vs the prior N-week period.
      // Exactly one of the two flags is ever true, so the disjunction is safe.
      const hasComparison = (hasPrev || hasPriorPeriod) && prevNet > 0;
      const yoyInfo = channelYoyInfo(channel, groupName, netSales, orders, isTotal, yoy);
      return {
        channel,
        orders,
        netSales,
        aov,
        pctRevenue: scopeTotal > 0 ? (100 * netSales) / scopeTotal : 0,
        wow: hasComparison ? share(netSales - prevNet, prevNet) : null,
        wowBase: hasComparison ? prevNet : null,
        yoy: yoyInfo.pct,
        yoyBase: yoyInfo.base,
        yoyBaseIsOrders: yoyInfo.isOrders,
        isTotal,
      };
    };
    return [
      ...group.channels.map((c) => row(c.channel, c.netSales, c.orders, c.aov, false)),
      row("TOTAL", group.netSales, group.orders, group.aov, true),
    ];
  };

  const mixColumnsAll: Column<ChannelRow>[] = [
    {
      key: "ch",
      header: "Channel",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold" : "font-medium"}>{r.channel}</span>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{int(r.orders)}</span>,
    },
    {
      key: "net-sales",
      header: "Net Sales",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{gbp(r.netSales)}</span>,
    },
    {
      key: "pct",
      header: "% revenue",
      align: "right",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold" : ""}>{pct(r.pctRevenue)}</span>
      ),
    },
    {
      key: "wow",
      header: isMulti ? priorLabel : "WoW",
      align: "right",
      // Colour covers the whole cell — base figure and percentage together — so
      // direction reads off the number, not just the bracket.
      render: (r) =>
        r.wowBase === null ? (
          <span className="text-tertiary">—</span>
        ) : (
          <span className={`${r.isTotal ? "font-semibold" : ""} ${deltaClass(r.wow)}`}>
            {gbp(r.wowBase)}
            <span className="ml-1 text-xs font-medium">({signedPct(r.wow)})</span>
          </span>
        ),
    },
    {
      key: "yoy",
      header: "YoY",
      align: "right",
      // The base is net sales at group/Own Delivery level and an ORDER COUNT for
      // every other channel, so it is formatted accordingly rather than forced
      // into one unit — see channelYoyInfo.
      render: (r) =>
        r.yoyBase === null ? (
          <span className="text-tertiary">—</span>
        ) : (
          <span className={`${r.isTotal ? "font-semibold" : ""} ${deltaClass(r.yoy)}`}>
            {r.yoyBaseIsOrders ? int(r.yoyBase) : gbp(r.yoyBase)}
            <span className="ml-1 text-xs font-medium">({signedPct(r.yoy)})</span>
          </span>
        ),
    },
    {
      key: "aov",
      header: "AOV",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{gbp(r.aov)}</span>,
    },
  ];
  // In multi-week mode the delta column compares against the prior N-week period;
  // it is dropped only when there is no prior period to compare against.
  const mixColumns =
    isMulti && !hasPriorPeriod ? mixColumnsAll.filter((c) => c.key !== "wow") : mixColumnsAll;

  // Comparison group feeding the Order Mix delta column.
  const mixPrevDelivery = isMulti ? priorCombined?.delivery ?? EMPTY_GROUP : prevCombined.delivery;
  const mixPrevInStore = isMulti ? priorCombined?.inStore ?? EMPTY_GROUP : prevCombined.inStore;

  const deliveryOrdersChart = combined.delivery.channels.map((c) => ({
    channel: c.channel,
    Orders: Math.round(c.orders),
  }));
  const inStoreOrdersChart = combined.inStore.channels.map((c) => ({
    channel: c.channel,
    Orders: Math.round(c.orders),
  }));

  // ---- Net sales by store (only meaningful when both stores are shown) ----
  const netSalesByStore = activeStores.map((s) => ({
    store: shortStore(s),
    "Net Sales": Math.round(byStore.get(s)!.netSales),
  }));

  // ---- Insight payload (scoped) ------------------------------------------
  // Commentary is single-week / WoW-framed, so it is skipped in multi-week mode.
  const insightInput: ExecInput | null =
    isMulti || !weekIso
      ? null
      : {
    dashboard: "executive",
    week: weekIso,
    store: activeStore,
    totalWow: netWow,
    combined: {
      netSales: combined.netSales,
      deliveryNetSales: combined.delivery.netSales,
      inStoreNetSales: combined.inStore.netSales,
      orders: combined.orders,
      aov: combined.aov,
      deliveryAov: combined.delivery.aov,
      inStoreAov: combined.inStore.aov,
      deliveryPct: share(combined.delivery.netSales, combined.netSales),
      inStorePct: share(combined.inStore.netSales, combined.netSales),
      customers: combined.customers,
    },
    stores: activeStores.map((s) => {
      const b = byStore.get(s)!;
      const row = rows.find((r) => r.store === s);
      return {
        store: s,
        netSales: b.netSales,
        deliveryNetSales: b.delivery.netSales,
        inStoreNetSales: b.inStore.netSales,
        orders: b.orders,
        aov: b.aov,
        deliveryAov: b.delivery.aov,
        inStoreAov: b.inStore.aov,
        customers: b.customers,
        deliveryPct: share(b.delivery.netSales, b.netSales),
        inStorePct: share(b.inStore.netSales, b.netSales),
        collectionPct: row ? n(row.collection_pct) : 0,
        eatInPct: row ? n(row.eat_in_pct) : 0,
        netSalesWow: (() => {
          const prevB = prevByStore.get(s);
          if (!hasPrev || !prevB || prevB.netSales <= 0) return null;
          return share(b.netSales - prevB.netSales, prevB.netSales);
        })(),
      };
    }),
  };
  const draft = insightInput
    ? (await import("@/lib/vm-analytics/insights")).buildInsights(insightInput)
    : null;

  // ---- KPI card comparison block -----------------------------------------
  // Every card carries the same two-column block in all three modes: the prior
  // YEAR on the left, the prior PERIOD on the right, each printing the figure it
  // is measured against above its own signed delta. The right-hand column is the
  // previous week in single-week mode and the preceding N weeks in 4/12-week
  // mode, so the % on a card can always be traced back to the two numbers that
  // produced it.
  const cmpLabel = isMulti ? `prev ${periodWeekCount}w` : "WoW";
  const cmpTitle = isMulti ? priorTitle : "Versus the previous week";
  const yoyTitle = isMulti
    ? `Same ${periodWeekCount} weeks last year — ${scopeLabel}`
    : `Same week last year (${yoyWeek}) — ${scopeLabel}`;

  // Picks the right-hand side for the active mode. Each side is gated on its own
  // availability flag so a missing comparison period renders "—" rather than the
  // zeros that `prevCombined` / the pct helpers coalesce to.
  const cmpSide = (
    weekValue: number,
    weekPct: number | null,
    priorValue: number | null,
    priorPct: number | null
  ): { value: number | null; pct: number | null } =>
    isMulti
      ? { value: hasPriorPeriod ? priorValue : null, pct: hasPriorPeriod ? priorPct : null }
      : { value: hasPrev ? weekValue : null, pct: hasPrev ? weekPct : null };

  const cmp = (
    fmt: (v: number) => string,
    yoyValue: number,
    yoyPct: number | null,
    side: { value: number | null; pct: number | null }
  ) => ({
    comparisons: [
      {
        label: "YoY",
        value: hasYoy && yoyValue > 0 ? fmt(yoyValue) : "—",
        pct: yoyPct,
        title: yoyTitle,
      },
      {
        label: cmpLabel,
        value: side.value !== null ? fmt(side.value) : "—",
        pct: side.pct,
        title: cmpTitle,
      },
    ] as const,
  });

  const priorNet = priorCombined?.netSales ?? null;
  const priorDelNet = priorCombined?.delivery.netSales ?? null;
  const priorInNet = priorCombined?.inStore.netSales ?? null;
  const priorOrders = priorCombined?.orders ?? null;
  const priorCustomers = priorCombined?.customers ?? null;
  const priorAov = priorCombined?.aov ?? null;

  return (
    <div className="space-y-7">
      <div>
        <PageTitle title="Executive Dashboard" subtitle={subtitle} />
        {isMulti && (
          <p className="-mt-4 text-xs text-tertiary">
            All figures are weekly averages — each value is the period total ÷ the number of weeks in
            that period ({periodMatched} here). The comparison period is averaged over its own week
            count, so the two are directly comparable. AOV and percentage metrics are already
            averages/ratios and are shown as-is.
          </p>
        )}
      </div>

      <KpiGrid>
        {/* Left column is always the prior year; the right column is the previous
            week in single-week mode and the preceding N weeks in 4/12-week mode. */}
        <KpiCard
          label="Net Sales"
          value={gbp(combined.netSales)}
          {...cmp(gbp, yoyTotalSales, netYoy, cmpSide(prevCombined.netSales, netWow, priorNet, netPrior))}
        />
        <KpiCard
          label="Net Sales — Delivery"
          value={gbp(combined.delivery.netSales)}
          {...cmp(
            gbp,
            yoyDeliverySales,
            delYoy,
            cmpSide(prevCombined.delivery.netSales, netDelWow, priorDelNet, netDelPrior)
          )}
        />
        <KpiCard
          label="Net Sales — In-store"
          value={gbp(combined.inStore.netSales)}
          tone="good"
          {...cmp(
            gbp,
            yoyInStoreSales,
            inStYoy,
            cmpSide(prevCombined.inStore.netSales, netInWow, priorInNet, netInPrior)
          )}
        />
        <KpiCard
          label="Total Orders"
          value={int(combined.orders)}
          {...cmp(int, yoyTotalOrdersEff, ordYoy, cmpSide(prevCombined.orders, ordWow, priorOrders, ordPrior))}
        />
        <KpiCard
          label="AOV (Blended)"
          value={gbp(combined.aov)}
          hint="net sales ÷ orders"
          {...cmp(gbp, yoyAovBlend, aovBlendYoy, cmpSide(prevCombined.aov, aovBlendWow, priorAov, aovBlendPrior))}
        />
        <KpiCard
          label="Customers"
          value={int(combined.customers)}
          {...cmp(
            int,
            yoyTotalCustomers,
            custYoy,
            cmpSide(prevCombined.customers, custWow, priorCustomers, custPrior)
          )}
        />
        <KpiCard
          label="Delivery %"
          value={pct(deliveryPct)}
          hint="of net sales"
          {...cmp(
            pct,
            yoyDeliveryPct,
            deliveryPctYoy,
            cmpSide(
              prevDeliveryPct,
              deliveryPctWow,
              priorCombined ? priorDeliveryPct : null,
              deliveryPctPrior
            )
          )}
        />
        <KpiCard
          label="In-store %"
          value={pct(inStorePct)}
          hint="of net sales"
          tone="good"
          {...cmp(
            pct,
            yoyInStorePct,
            inStorePctYoy,
            cmpSide(
              prevInStorePct,
              inStorePctWow,
              priorCombined ? priorInStorePct : null,
              inStorePctPrior
            )
          )}
        />
      </KpiGrid>

      {/* Commentary is weekly/WoW-framed; skip it in multi-week mode. */}
      {draft && insightInput && <Commentary initial={draft} input={insightInput} />}

      <Section
        title="Order Mix"
        description="Delivery and in-store channels, each showing its share of total net sales with week-on-week and year-on-year change."
      >
        {/* Stacked, not side by side: the WoW/YoY columns now carry a figure as
            well as a percentage, which needs the full page width to stay legible. */}
        <div className="grid gap-4">
          <ChartCard
            title={`Delivery Orders — ${int(combined.delivery.orders)} (${pct(
              share(combined.delivery.orders, combined.orders)
            )} of orders)`}
          >
            <DataTable
              columns={mixColumns}
              rows={buildChannelTable(combined.delivery, mixPrevDelivery, "delivery", yoyRow)}
            />
            {deliveryOrdersChart.length > 0 && (
              <div className="mt-6">
                <BarChartCard
                  data={deliveryOrdersChart}
                  xKey="channel"
                  bars={[{ key: "Orders", name: "Orders" }]}
                  height={220}
                />
              </div>
            )}
          </ChartCard>
          <ChartCard
            title={`In-store Orders — ${int(combined.inStore.orders)} (${pct(
              share(combined.inStore.orders, combined.orders)
            )} of orders)`}
          >
            <DataTable
              columns={mixColumns}
              rows={buildChannelTable(combined.inStore, mixPrevInStore, "inStore", yoyRow)}
            />
            {inStoreOrdersChart.length > 0 && (
              <div className="mt-4">
                <BarChartCard
                  data={inStoreOrdersChart}
                  xKey="channel"
                  bars={[{ key: "Orders", name: "Orders" }]}
                  height={220}
                />
              </div>
            )}
          </ChartCard>
        </div>
      </Section>

      <Section
        title="KPI Summary"
        description={(() => {
          const compare = isMulti ? "prior-year same-period values" : "previous-week values";
          const base = activeStore
            ? `${shortStore(activeStore)} only, with ${compare}.`
            : `Both stores side by side, with combined totals and ${compare}.`;
          const yoyNote = isMulti
            ? " YoY% compares this period's weekly average against the same period last year's weekly average (both = total ÷ N); as a ratio the % is unaffected by the averaging — e.g. £16,000 vs £12,000 over 4 weeks is (£4,000 − £3,000) ÷ £3,000 = +33.33%."
            : "";
          return base + yoyNote;
        })()}
      >
        <DataTable columns={summaryColumns} rows={kpiRows} />
      </Section>

      {activeStores.length > 1 && (
        <Section title="Visual Breakdown">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Net Sales by Store">
              <BarChartCard
                data={netSalesByStore}
                xKey="store"
                bars={[{ key: "Net Sales", name: "Net Sales" }]}
                currency
              />
            </ChartCard>
            <ChartCard title="Sales: Delivery vs In-store">
              <BarChartCard
                data={[
                  {
                    scope: scopeLabel,
                    Delivery: Math.round(combined.delivery.netSales),
                    "In-store": Math.round(combined.inStore.netSales),
                  },
                ]}
                xKey="scope"
                bars={[
                  { key: "Delivery", name: "Delivery" },
                  { key: "In-store", name: "In-store" },
                ]}
                currency
              />
            </ChartCard>
          </div>
        </Section>
      )}
    </div>
  );
}
