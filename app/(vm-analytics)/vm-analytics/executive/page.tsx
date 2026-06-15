import { getExec, resolveWeek, previousWeek, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange, signedPct } from "@/lib/vm-analytics/format";
import { shortStore, STORES } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { ExecRow } from "@/lib/vm-analytics/types";
import type { ExecInput } from "@/lib/vm-analytics/insights";

export const dynamic = "force-dynamic";

interface Metrics {
  netSales: number;
  orders: number;
  aov: number;
  customers: number;
  deliveryAmt: number;
  collectionAmt: number;
  eatInAmt: number;
}

function metricsOf(rows: ExecRow[]): Metrics {
  const m: Metrics = {
    netSales: 0,
    orders: 0,
    aov: 0,
    customers: 0,
    deliveryAmt: 0,
    collectionAmt: 0,
    eatInAmt: 0,
  };
  for (const r of rows) {
    m.netSales += n(r.net_sales);
    m.orders += n(r.number_of_orders);
    m.customers += n(r.customer_count);
    m.deliveryAmt += n(r.delivery_sales_amount);
    m.collectionAmt += n(r.collection_sales_amount);
    m.eatInAmt += n(r.eat_in_sales_amount);
  }
  m.aov = m.orders > 0 ? m.netSales / m.orders : 0;
  return m;
}

const share = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  let weekIso: string | null;
  let rows: ExecRow[];
  let prevRows: ExecRow[] = [];
  let weekEnd = "";
  try {
    weekIso = await resolveWeek(searchParams.week);
    if (!weekIso) return <EmptyWeek />;
    rows = await getExec(weekIso);
    const prevIso = await previousWeek(weekIso);
    if (prevIso) prevRows = await getExec(prevIso);
    const weeks = await getWeeks();
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
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

  const byStore = (s: string) => rows.filter((r) => r.store === s);
  const total = metricsOf(rows);
  const prevTotal = metricsOf(prevRows);
  const hasPrev = prevRows.length > 0;

  const totalNetWow = hasPrev ? share(total.netSales - prevTotal.netSales, prevTotal.netSales) : null;
  const totalOrdWow = hasPrev ? share(total.orders - prevTotal.orders, prevTotal.orders) : null;
  const totalCustWow = hasPrev ? share(total.customers - prevTotal.customers, prevTotal.customers) : null;
  const totalAovWow =
    hasPrev && prevTotal.aov > 0 ? share(total.aov - prevTotal.aov, prevTotal.aov) : null;

  const storeMetrics = STORES.map((s) => ({ store: s, m: metricsOf(byStore(s)) }));

  const prevCell = (val: number, isCurrency: boolean, isPct: boolean) =>
    !hasPrev ? "—" : isPct ? pct(val) : isCurrency ? gbp(val) : int(val);

  type KpiRowDef = {
    kpi: string;
    cell: (m: Metrics) => string;
    prev: string;
  };
  const kpiRows: KpiRowDef[] = [
    {
      kpi: "Net Sales",
      cell: (m) => gbp(m.netSales),
      prev: prevCell(prevTotal.netSales, true, false),
    },
    {
      kpi: "Orders",
      cell: (m) => int(m.orders),
      prev: prevCell(prevTotal.orders, false, false),
    },
    {
      kpi: "AOV",
      cell: (m) => gbp(m.aov),
      prev: prevCell(prevTotal.aov, true, false),
    },
    {
      kpi: "Customers",
      cell: (m) => int(m.customers),
      prev: prevCell(prevTotal.customers, false, false),
    },
    {
      kpi: "Delivery %",
      cell: (m) => pct(share(m.deliveryAmt, m.netSales)),
      prev: prevCell(share(prevTotal.deliveryAmt, prevTotal.netSales), false, true),
    },
    {
      kpi: "Collection Sales %",
      cell: (m) => pct(share(m.collectionAmt, m.netSales)),
      prev: prevCell(share(prevTotal.collectionAmt, prevTotal.netSales), false, true),
    },
    {
      kpi: "Eat-In Sales %",
      cell: (m) => pct(share(m.eatInAmt, m.netSales)),
      prev: prevCell(share(prevTotal.eatInAmt, prevTotal.netSales), false, true),
    },
  ];

  const tableColumns: Column<KpiRowDef>[] = [
    { key: "kpi", header: "KPI", render: (r) => <span className="font-medium">{r.kpi}</span> },
    {
      key: "hitchin",
      header: shortStore(STORES[0]),
      align: "right",
      render: (r) => r.cell(storeMetrics[0].m),
    },
    {
      key: "stevenage",
      header: shortStore(STORES[1]),
      align: "right",
      render: (r) => r.cell(storeMetrics[1].m),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => <span className="font-semibold">{r.cell(total)}</span>,
    },
    {
      key: "prev",
      header: "Previous Week",
      align: "right",
      render: (r) => <span className="text-ink-faint">{r.prev}</span>,
    },
  ];

  const netSalesByStore = storeMetrics.map((sm) => ({
    store: shortStore(sm.store),
    "Net Sales": Math.round(sm.m.netSales),
  }));
  const channelMix = storeMetrics.map((sm) => ({
    store: shortStore(sm.store),
    Delivery: Math.round(sm.m.deliveryAmt),
    Collection: Math.round(sm.m.collectionAmt),
    "Eat-In": Math.round(sm.m.eatInAmt),
  }));

  const insightInput: ExecInput = {
    dashboard: "executive",
    week: weekIso,
    totalWow: totalNetWow,
    stores: storeMetrics.map((sm) => {
      const row = byStore(sm.store)[0];
      return {
        store: sm.store,
        netSales: sm.m.netSales,
        orders: sm.m.orders,
        aov: sm.m.aov,
        customers: sm.m.customers,
        deliveryPct: share(sm.m.deliveryAmt, sm.m.netSales),
        collectionPct: share(sm.m.collectionAmt, sm.m.netSales),
        eatInPct: share(sm.m.eatInAmt, sm.m.netSales),
        netSalesWow: row ? (row.net_sales_wow_pct === null ? null : n(row.net_sales_wow_pct)) : null,
      };
    }),
  };
  const draft = (await import("@/lib/vm-analytics/insights")).buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Executive Dashboard"
        subtitle={`High-level overview · ${weekRange(weekIso, weekEnd)}`}
      />

      <KpiGrid>
        <KpiCard label="Net Sales (Total)" value={gbp(total.netSales)} delta={totalNetWow} />
        <KpiCard label="Orders (Total)" value={int(total.orders)} delta={totalOrdWow} />
        <KpiCard label="AOV (Blended)" value={gbp(total.aov)} delta={totalAovWow} />
        <KpiCard label="Customers (Total)" value={int(total.customers)} delta={totalCustWow} />
        <KpiCard label="Delivery %" value={pct(share(total.deliveryAmt, total.netSales))} />
        <KpiCard label="Collection %" value={pct(share(total.collectionAmt, total.netSales))} />
        <KpiCard label="Eat-In %" value={pct(share(total.eatInAmt, total.netSales))} />
        <KpiCard
          label="Net Sales WoW"
          value={signedPct(totalNetWow)}
          hint={hasPrev ? "vs previous week" : "no prior week"}
        />
      </KpiGrid>

      <Commentary initial={draft} input={insightInput} />

      <Section title="KPI Summary" description="Both stores side by side, with previous-week totals.">
        <DataTable columns={tableColumns} rows={kpiRows} />
      </Section>

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
          <ChartCard title="Sales by Fulfilment Channel">
            <BarChartCard
              data={channelMix}
              xKey="store"
              bars={[
                { key: "Delivery", name: "Delivery" },
                { key: "Collection", name: "Collection" },
                { key: "Eat-In", name: "Eat-In" },
              ]}
              currency
            />
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}
