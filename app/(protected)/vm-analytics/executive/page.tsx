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

  // Own Delivery vs Aggregator (Deliveroo + Uber Eats + Just Eat) net sales,
  // used for the YoY comparisons below.
  const ownDel = ownDelivery(combined.delivery);
  const aggDel = aggregator(combined.delivery);

  // ---- YoY deltas (from historical Excel data) ----------------------------
  const hasYoy = yoyRow !== null;
  const yoyTotalSales    = yoyRow ? n(yoyRow.total_sales)         : 0;
  const yoyDeliverySales = yoyRow ? n(yoyRow.delivery_sales)      : 0;
  const yoyInStoreSales  = yoyRow ? n(yoyRow.in_store_sales)      : 0;
  const yoyOwnDelivery   = yoyRow ? n(yoyRow.own_delivery_sales)  : 0;
  const yoyAggregate     = yoyRow ? n(yoyRow.aggregate_sales)     : 0;

  const netYoy    = hasYoy && yoyTotalSales    > 0 ? share(combined.netSales           - yoyTotalSales,    yoyTotalSales)    : null;
  const delYoy    = hasYoy && yoyDeliverySales > 0 ? share(combined.delivery.netSales  - yoyDeliverySales, yoyDeliverySales) : null;
  const inStYoy   = hasYoy && yoyInStoreSales  > 0 ? share(combined.inStore.netSales   - yoyInStoreSales,  yoyInStoreSales)  : null;
  const ownDelYoy = hasYoy && yoyOwnDelivery   > 0 ? share(ownDel.netSales             - yoyOwnDelivery,   yoyOwnDelivery)   : null;
  const aggYoy    = hasYoy && yoyAggregate     > 0 ? share(aggDel.netSales             - yoyAggregate,     yoyAggregate)     : null;

  // YoY deltas for orders and customers (from EPOS data)
  const yoyTotalOrders    = yoyRow ? n(yoyRow.total_orders)    : 0;
  const yoyTotalCustomers = yoyRow ? n(yoyRow.total_customers)  : 0;

  const ordYoy  = hasYoy && yoyTotalOrders    > 0 ? share(combined.orders     - yoyTotalOrders,    yoyTotalOrders)    : null;
  const custYoy = hasYoy && yoyTotalCustomers > 0 ? share(combined.customers  - yoyTotalCustomers, yoyTotalCustomers) : null;

  // AOV (Blended) YoY — same base as the table's YoY cell: total sales ÷ total
  // orders (falling back to summed channel order counts when total_orders is 0).
  const yoyTotalOrdersEff = yoyRow
    ? n(yoyRow.total_orders) ||
      (n(yoyRow.own_delivery) + n(yoyRow.deliveroo) + n(yoyRow.just_eat) + n(yoyRow.uber_eats) +
        n(yoyRow.click_collect) + n(yoyRow.kiosk) + n(yoyRow.till_eat_in) + n(yoyRow.till_takeaway))
    : 0;
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

  const yoyPctMap: Record<string, number | null> = {
    "Net Sales": netYoy,
    "Net Sales — Delivery": delYoy,
    "Net Sales — Own Delivery": ownDelYoy,
    "Net Sales — Aggregator": aggYoy,
    "Net Sales — In-store": inStYoy,
  };

  // ---- KPI Summary table (per store) -------------------------------------
  type KpiRowDef = {
    kpi: string;
    indent?: boolean;
    // Semantic colour: "good" (green) for in-store / own delivery, "bad" (red)
    // for aggregator. Drives the value colour in every store column.
    tone?: "good" | "bad";
    cell: (b: Breakdown) => string;
    // Primary numeric behind the cell, used to compute the WoW % shown next to
    // the previous-week value (combined vs previous-week combined).
    wowVal?: (b: Breakdown) => number;
  };

  const kpiRows: KpiRowDef[] = [
    { kpi: "Net Sales", cell: (b) => gbp(b.netSales), wowVal: (b) => b.netSales },
    { kpi: "Net Sales — Delivery", cell: (b) => gbp(b.delivery.netSales), wowVal: (b) => b.delivery.netSales },
    { kpi: "Net Sales — Own Delivery", indent: true, tone: "good", cell: (b) => gbp(ownDelivery(b.delivery).netSales), wowVal: (b) => ownDelivery(b.delivery).netSales },
    { kpi: "Net Sales — Aggregator", indent: true, tone: "bad", cell: (b) => gbp(aggregator(b.delivery).netSales), wowVal: (b) => aggregator(b.delivery).netSales },
    { kpi: "Net Sales — In-store", tone: "good", cell: (b) => gbp(b.inStore.netSales), wowVal: (b) => b.inStore.netSales },
    { kpi: "Total Orders", cell: (b) => int(b.orders) },
    { kpi: "Customers", cell: (b) => int(b.customers) },
    { kpi: "AOV (Blended)", cell: (b) => gbp(b.aov) },
    { kpi: "AOV — Delivery", cell: (b) => gbp(b.delivery.aov) },
    { kpi: "AOV — Own Delivery", indent: true, tone: "good", cell: (b) => gbp(ownDelivery(b.delivery).aov) },
    { kpi: "AOV — Aggregator", indent: true, tone: "bad", cell: (b) => gbp(aggregator(b.delivery).aov) },
    { kpi: "AOV — In-store", tone: "good", cell: (b) => gbp(b.inStore.aov) },
  ];

  // Green for margin-friendly rows (in-store / own delivery), red for aggregator.
  const toneClass = (tone?: "good" | "bad") =>
    tone === "good"
      ? "text-success"
      : tone === "bad"
      ? "text-danger"
      : "";

  const getYoyCellValue = (kpiLabel: string, yoy: YoyRow | null): string => {
    if (!yoy) return "—";

    // Derived channel groups from the new EPOS order-count columns
    const yoyOwnDel  = n(yoy.own_delivery);
    const yoyDel     = n(yoy.deliveroo) + n(yoy.just_eat) + n(yoy.uber_eats);
    const yoyDelAll  = yoyOwnDel + yoyDel;
    const yoyIns     = n(yoy.click_collect) + n(yoy.kiosk) + n(yoy.till_eat_in) + n(yoy.till_takeaway);
    const yoyTotOrd  = n(yoy.total_orders) || (yoyDelAll + yoyIns);

    switch (kpiLabel) {
      // ── Net Sales (already populated) ──────────────────────────────────────
      case "Net Sales":                return gbp(n(yoy.total_sales));
      case "Net Sales — Delivery":     return gbp(n(yoy.delivery_sales));
      case "Net Sales — Own Delivery": return gbp(n(yoy.own_delivery_sales));
      case "Net Sales — Aggregator":   return gbp(n(yoy.aggregate_sales));
      case "Net Sales — In-store":     return gbp(n(yoy.in_store_sales));

      // ── Orders & Customers (new EPOS columns) ──────────────────────────────
      case "Total Orders": return yoyTotOrd > 0 ? int(yoyTotOrd) : "—";
      case "Customers":    return n(yoy.total_customers) > 0 ? int(n(yoy.total_customers)) : "—";

      // ── AOV (derived from sales ÷ orders) ──────────────────────────────────
      case "AOV (Blended)":
        return yoyTotOrd > 0 && n(yoy.total_sales) > 0
          ? gbp(n(yoy.total_sales) / yoyTotOrd)
          : "—";
      case "AOV — Delivery":
        return yoyDelAll > 0 && n(yoy.delivery_sales) > 0
          ? gbp(n(yoy.delivery_sales) / yoyDelAll)
          : "—";
      case "AOV — Own Delivery":
        return yoyOwnDel > 0 && n(yoy.own_delivery_sales) > 0
          ? gbp(n(yoy.own_delivery_sales) / yoyOwnDel)
          : "—";
      case "AOV — Aggregator":
        return yoyDel > 0 && n(yoy.aggregate_sales) > 0
          ? gbp(n(yoy.aggregate_sales) / yoyDel)
          : "—";
      case "AOV — In-store":
        return yoyIns > 0 && n(yoy.in_store_sales) > 0
          ? gbp(n(yoy.in_store_sales) / yoyIns)
          : "—";

      default:
        return "—";
    }
  };

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
      render: (r: KpiRowDef) => <span className={toneClass(r.tone)}>{r.cell(byStore.get(s)!)}</span>,
    })),
    // Total column only adds information when more than one store is shown.
    ...(activeStores.length > 1
      ? [
          {
            key: "total",
            header: "Total",
            align: "right" as const,
            render: (r: KpiRowDef) => (
              <span className={`font-semibold ${toneClass(r.tone)}`}>{r.cell(combined)}</span>
            ),
          },
        ]
      : []),
    // Comparison column: "Previous Week" in single-week mode, "Previous N Weeks"
    // in 4/12-week mode. Both render the comparison period's value with its
    // delta in brackets; the bracketed % only appears on rows that define a
    // `wowVal` accessor (the five Net Sales rows).
    ...(isMulti
      ? hasPriorPeriod
        ? [
            {
              key: "prior",
              header: `Previous ${periodWeekCount} Weeks`,
              align: "right" as const,
              render: (r: KpiRowDef) => {
                const pct =
                  r.wowVal && priorCombined ? priorDelta(r.wowVal(combined), r.wowVal(priorCombined)) : null;
                return (
                  <span className="text-tertiary">
                    {priorCombined ? r.cell(priorCombined) : "—"}
                    {pct !== null && (
                      <span className={`ml-1.5 font-medium ${deltaClass(pct)}`}>({signedPct(pct)})</span>
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
              const wowPct =
                hasPrev && r.wowVal
                  ? (() => {
                      const prev = r.wowVal(prevCombined);
                      return prev > 0 ? share(r.wowVal!(combined) - prev, prev) : null;
                    })()
                  : null;
              return (
                <span className="text-tertiary">
                  {hasPrev ? r.cell(prevCombined) : "—"}
                  {wowPct !== null && (
                    <span className={`ml-1.5 font-medium ${deltaClass(wowPct)}`}>
                      ({signedPct(wowPct)})
                    </span>
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
        const yoyPct = yoyPctMap[r.kpi] ?? null;
        return (
          <span className="text-text-muted text-sm">
            {getYoyCellValue(r.kpi, yoyRow)}
            {yoyPct !== null && (
              <span className={`ml-1.5 font-medium ${deltaClass(yoyPct)}`}>
                ({signedPct(yoyPct)})
              </span>
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
    yoy: number | null; // vs prior year (see channelYoy for the basis)
    isTotal?: boolean;
  }

  // Per-channel YoY is order-count based — historical net sales exist only at the
  // group (Delivery/In-store TOTAL) and Own Delivery level, not per aggregator or
  // in-store channel. Mirrors getYoyCellValue's best-available basis.
  const channelYoy = (
    channel: string,
    groupName: "delivery" | "inStore",
    netSales: number,
    orders: number,
    isTotal: boolean,
    yoy: YoyRow | null
  ): number | null => {
    if (!yoy) return null;
    if (isTotal) {
      const base = groupName === "delivery" ? n(yoy.delivery_sales) : n(yoy.in_store_sales);
      return base > 0 ? share(netSales - base, base) : null;
    }
    if (/own|direct/i.test(channel)) {
      const base = n(yoy.own_delivery_sales);
      return base > 0 ? share(netSales - base, base) : null;
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
    return base && base > 0 ? share(orders - base, base) : null;
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
      return {
        channel,
        orders,
        netSales,
        aov,
        pctRevenue: scopeTotal > 0 ? (100 * netSales) / scopeTotal : 0,
        // Single-week: vs previous week. Multi-week: vs the prior N-week period.
        // Exactly one of the two flags is ever true, so the disjunction is safe.
        wow: (hasPrev || hasPriorPeriod) && prevNet > 0 ? share(netSales - prevNet, prevNet) : null,
        yoy: channelYoy(channel, groupName, netSales, orders, isTotal, yoy),
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
      header: isMulti ? priorLabel : "WoW%",
      align: "right",
      render: (r) => (
        <span className={`font-medium ${deltaClass(r.wow)}`}>{signedPct(r.wow)}</span>
      ),
    },
    {
      key: "yoy",
      header: "YoY%",
      align: "right",
      render: (r) => (
        <span className={`font-medium ${deltaClass(r.yoy)}`}>{signedPct(r.yoy)}</span>
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

  // Delta badge: week-on-week in single-week mode, prior-period in 4/12-week
  // mode. `undefined` hides the badge entirely (null would render it greyed).
  const wow = (wowVal: number | null, priorVal: number | null = null) =>
    isMulti ? (hasPriorPeriod ? priorVal : undefined) : wowVal;

  // Spread onto every KpiCard: relabels the delta badge in multi-week mode and
  // falls back to the component's "WoW" defaults in single-week mode.
  const deltaBadge = isMulti ? { deltaLabel: priorLabel, deltaTitle: priorTitle } : {};

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
        {/* Single-week shows WoW; 4/12-week shows the prior-period comparison.
            When neither exists the badge is omitted (undefined hides it). */}
        <KpiCard label="Net Sales" value={gbp(combined.netSales)} delta={wow(netWow, netPrior)} {...deltaBadge} yoy={netYoy} />
        <KpiCard label="Net Sales — Delivery" value={gbp(combined.delivery.netSales)} delta={wow(netDelWow, netDelPrior)} {...deltaBadge} yoy={delYoy} />
        <KpiCard label="Net Sales — In-store" value={gbp(combined.inStore.netSales)} delta={wow(netInWow, netInPrior)} {...deltaBadge} yoy={inStYoy} tone="good" />
        <KpiCard label="Total Orders" value={int(combined.orders)} delta={wow(ordWow, ordPrior)} {...deltaBadge} yoy={ordYoy} />
        <KpiCard
          label="AOV (Blended)"
          value={gbp(combined.aov)}
          delta={wow(aovBlendWow, aovBlendPrior)}
          {...deltaBadge}
          yoy={aovBlendYoy}
          hint="net sales ÷ orders"
        />
        <KpiCard label="Customers" value={int(combined.customers)} delta={wow(custWow, custPrior)} {...deltaBadge} yoy={custYoy} />
        <KpiCard label="Delivery %" value={pct(deliveryPct)} delta={wow(deliveryPctWow, deliveryPctPrior)} {...deltaBadge} yoy={deliveryPctYoy} hint="of net sales" />
        <KpiCard label="In-store %" value={pct(inStorePct)} delta={wow(inStorePctWow, inStorePctPrior)} {...deltaBadge} yoy={inStorePctYoy} hint="of net sales" tone="good" />
      </KpiGrid>

      {/* Commentary is weekly/WoW-framed; skip it in multi-week mode. */}
      {draft && insightInput && <Commentary initial={draft} input={insightInput} />}

      <Section
        title="Order Mix"
        description="Delivery and in-store channels, each showing its share of total net sales with week-on-week and year-on-year change."
      >
        <div className="grid gap-4 lg:grid-cols-2">
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
