import { getComparison, getExec, getExecChannels, resolveWeek, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import { shortStore, STORES } from "@/lib/vm-analytics/constants";
import { share, buildBreakdown, ownDelivery, aggregator, type Breakdown } from "@/lib/vm-analytics/channels";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type ComparisonInput } from "@/lib/vm-analytics/insights";
import type { ComparisonRow, ExecRow, ExecChannelRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

export default async function StoreComparisonPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  let weekIso: string | null;
  let rows: ComparisonRow[];
  let execRows: ExecRow[] = [];
  let chanRows: ExecChannelRow[] = [];
  let prevExecRows: ExecRow[] = [];
  let prevChanRows: ExecChannelRow[] = [];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
    const prevIso = idx >= 0 ? weeks[idx + 1]?.week_start_iso ?? null : null;
    [rows, execRows, chanRows, prevExecRows, prevChanRows] = await Promise.all([
      getComparison(weekIso),
      getExec(weekIso),
      getExecChannels(weekIso),
      prevIso ? getExec(prevIso) : Promise.resolve<ExecRow[]>([]),
      prevIso ? getExecChannels(prevIso) : Promise.resolve<ExecChannelRow[]>([]),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Store Comparison" />
        <EmptyWeek />
      </>
    );
  }

  const get = (s: string) => rows.find((r) => r.store === s);
  // Delivery / in-store AOV split, computed identically to the Executive and
  // Exception dashboards so the numbers line up across the suite.
  const breakdowns = new Map<string, Breakdown>(
    STORES.map((s) => [s, buildBreakdown([s], execRows, chanRows)])
  );
  const bd = (s: string) => breakdowns.get(s);

  const hasPrev = prevExecRows.length > 0;
  const prevBreakdowns = hasPrev
    ? new Map<string, Breakdown>(STORES.map((s) => [s, buildBreakdown([s], prevExecRows, prevChanRows)]))
    : null;

  interface MetricRow {
    metric: string;
    fmt: (v: number) => string;
    values: number[];
    higherIsBetter: boolean;
  }
  const stores = STORES.map((s) => get(s));
  const vals = (pick: (r: ComparisonRow) => number) =>
    stores.map((r) => (r ? pick(r) : 0));
  const bdVals = (pick: (b: Breakdown) => number) =>
    STORES.map((s) => {
      const b = bd(s);
      return b ? pick(b) : 0;
    });

  const metricRows: MetricRow[] = [
    // { metric: "Gross Sales", fmt: gbp, values: vals((r) => n(r.gross_sales)), higherIsBetter: true },
    { metric: "Net Sales", fmt: gbp, values: vals((r) => n(r.net_sales)), higherIsBetter: true },
    { metric: "Orders", fmt: int, values: vals((r) => n(r.total_orders)), higherIsBetter: true },
    { metric: "AOV — Delivery", fmt: gbp, values: bdVals((b) => b.delivery.aov), higherIsBetter: true },
    { metric: "AOV — In-store", fmt: gbp, values: bdVals((b) => b.inStore.aov), higherIsBetter: true },
    { metric: "AOV (Combined)", fmt: gbp, values: bdVals((b) => b.aov), higherIsBetter: true },
    { metric: "Customers", fmt: int, values: vals((r) => n(r.total_customers)), higherIsBetter: true },
    { metric: "New Customer %", fmt: (v) => pct(v), values: vals((r) => n(r.new_customer_pct)), higherIsBetter: true },
    // Delivery mix split into Own Delivery (margin-friendly → higher is better)
    // and Aggregate (commission → higher is worse). All three shares are % of
    // that store's net sales and sum to 100%.
    {
      metric: "Own Delivery %",
      fmt: (v) => pct(v),
      values: bdVals((b) => (b.netSales > 0 ? (100 * ownDelivery(b.delivery).netSales) / b.netSales : 0)),
      higherIsBetter: true,
    },
    {
      metric: "Aggregate %",
      fmt: (v) => pct(v),
      values: bdVals((b) => (b.netSales > 0 ? (100 * aggregator(b.delivery).netSales) / b.netSales : 0)),
      higherIsBetter: false,
    },
    // In-store is the most profitable channel, so a higher share is better.
    { metric: "In Store %", fmt: (v) => pct(v), values: bdVals((b) => b.inStorePct), higherIsBetter: true },
  ];

  const columns: Column<MetricRow>[] = [
    { key: "metric", header: "Metric", render: (r) => <span className="font-medium">{r.metric}</span> },
    ...STORES.map((s, i) => ({
      key: s,
      header: shortStore(s),
      align: "right" as const,
      render: (r: MetricRow) => {
        const isLead =
          r.values.length === 2 &&
          ((r.higherIsBetter && r.values[i] >= r.values[1 - i]) ||
            (!r.higherIsBetter && r.values[i] <= r.values[1 - i])) &&
          r.values[i] !== r.values[1 - i];
        return (
          <span className={isLead ? "font-semibold text-success" : ""}>
            {r.fmt(r.values[i])}
          </span>
        );
      },
    })),
    {
      key: "gap",
      header: "Difference",
      align: "right",
      render: (r) => {
        if (r.values.length !== 2) return "—";
        const [a, b] = r.values;
        const diff = a - b;
        const base = Math.max(Math.abs(a), Math.abs(b));
        const pctGap = base > 0 ? (Math.abs(diff) / Math.min(a, b || 1)) * 100 : 0;
        return (
          <span className="text-text-muted">
            {r.fmt(Math.abs(diff))}{" "}
            <span className="text-text-muted opacity-60">({pct(pctGap)})</span>
          </span>
        );
      },
    },
  ];

  const revChart = STORES.map((s) => {
    const b = bd(s);
    const r = get(s);
    return {
      store: shortStore(s),
      "Net Sales": Math.round(b ? b.netSales : n(r?.net_sales)),
      Orders: Math.round(b ? b.orders : n(r?.total_orders)),
    };
  });

  const insightInput: ComparisonInput = {
    dashboard: "store-comparison",
    week: weekIso,
    stores: STORES.map((s) => {
      const r = get(s);
      const b = bd(s);
      return {
        store: s,
        revenue: b ? b.netSales : n(r?.net_sales),
        orders: n(r?.total_orders),
        aov: b ? b.aov : n(r?.aov),
        deliveryAov: b ? b.delivery.aov : 0,
        inStoreAov: b ? b.inStore.aov : 0,
        customers: n(r?.total_customers),
      };
    }),
  };
  const draft = buildInsights(insightInput);

  const wowFor = (s: string): number | null => {
    if (!prevBreakdowns) return null;
    const cur = bd(s);
    const prev = prevBreakdowns.get(s);
    if (!cur || !prev || prev.netSales <= 0) return null;
    return share(cur.netSales - prev.netSales, prev.netSales);
  };

  return (
    <div className="space-y-7">
      <PageTitle
        title="Store Comparison"
        subtitle={`Hitchin vs Stevenage · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <div className="grid grid-cols-2 gap-3">
        {STORES.map((s) => {
          const r = get(s);
          return (
            <div key={s} className="vm-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {shortStore(s)}
              </div>
              <div className="mt-1 text-2xl font-semibold text-text-primary">
                {gbp(n(r?.net_sales))}
              </div>
              <div className="mt-1 text-xs">
                <span className={deltaClass(wowFor(s))}>{signedPct(wowFor(s))} WoW</span>
                <span className="ml-2 text-text-muted">{int(n(r?.total_orders))} orders</span>
              </div>
            </div>
          );
        })}
      </div>

      <Section
        title="Head-to-Head"
        description="Leading store per metric is highlighted. Labour cost / labour % is not captured in Vita Mojo — add it as a manual input to complete the operational view."
      >
        <DataTable columns={columns} rows={metricRows} />
      </Section>

      <Section title="Revenue & Orders">
        <ChartCard title="Net Sales by Store">
          <BarChartCard
            data={revChart}
            xKey="store"
            bars={[{ key: "Net Sales", name: "Net Sales" }]}
            currency
            height={320}
          />
        </ChartCard>
      </Section>
    </div>
  );
}
