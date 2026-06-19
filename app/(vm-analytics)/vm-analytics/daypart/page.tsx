import { getDaypartChannels, getDaypartChannelDetail, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, weekRange } from "@/lib/vm-analytics/format";
import { shortStore, resolveStore } from "@/lib/vm-analytics/constants";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type DaypartInput } from "@/lib/vm-analytics/insights";
import type { DaypartChannelRow, DaypartChannelDetailRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

// Morning (5-11am) is dropped: both stores open after that (Hitchin 12:00,
// Stevenage 11:30), so any orders in that bucket are pre-opening noise. When the
// finer detail view is used the SQL already filters pre-open orders, but we
// still drop rank 1 here so the column is gone even on the fallback path.
const MORNING_RANK = 1;

interface DaypartAgg {
  daypart: string;
  rank: number;
  orders: number;
  revenue: number;
  aov: number;
  deliveryOrders: number;
  deliveryRevenue: number;
  inStoreOrders: number;
  inStoreRevenue: number;
  deliveryAov: number;
  inStoreAov: number;
  // Finer cuts (null when only the Delivery/In-store fallback view is available).
  ownOrders: number | null;
  ownRevenue: number | null;
  ownAov: number | null;
  aggOrders: number | null;
  aggRevenue: number | null;
  aggAov: number | null;
}

const isAggregate = (ch: string) => /deliveroo|uber|just\s*eat/i.test(ch);
const isOwn = (ch: string) => /own|direct/i.test(ch);

const aov = (rev: number, ord: number) => (ord > 0 ? rev / ord : 0);

// Build the period rows from the finer detail view (preferred).
function fromDetail(rows: DaypartChannelDetailRow[]): DaypartAgg[] {
  const m = new Map<string, DaypartAgg>();
  for (const r of rows) {
    if (r.daypart_rank === MORNING_RANK) continue;
    const cur =
      m.get(r.daypart) ??
      ({
        daypart: r.daypart,
        rank: r.daypart_rank,
        orders: 0,
        revenue: 0,
        aov: 0,
        deliveryOrders: 0,
        deliveryRevenue: 0,
        inStoreOrders: 0,
        inStoreRevenue: 0,
        deliveryAov: 0,
        inStoreAov: 0,
        ownOrders: 0,
        ownRevenue: 0,
        ownAov: 0,
        aggOrders: 0,
        aggRevenue: 0,
        aggAov: 0,
      } as DaypartAgg);
    const orders = n(r.orders);
    const revenue = n(r.net_sales);
    cur.orders += orders;
    cur.revenue += revenue;
    if (r.channel_group === "delivery") {
      cur.deliveryOrders += orders;
      cur.deliveryRevenue += revenue;
    } else {
      cur.inStoreOrders += orders;
      cur.inStoreRevenue += revenue;
    }
    if (isOwn(r.channel_name)) {
      cur.ownOrders! += orders;
      cur.ownRevenue! += revenue;
    } else if (isAggregate(r.channel_name)) {
      cur.aggOrders! += orders;
      cur.aggRevenue! += revenue;
    }
    m.set(r.daypart, cur);
  }
  return finalise(Array.from(m.values()), true);
}

// Fallback: only the Delivery/In-store split is available — finer cuts stay null.
function fromBasic(rows: DaypartChannelRow[]): DaypartAgg[] {
  const m = new Map<string, DaypartAgg>();
  for (const c of rows) {
    if (c.daypart_rank === MORNING_RANK) continue;
    const cur =
      m.get(c.daypart) ??
      ({
        daypart: c.daypart,
        rank: c.daypart_rank,
        orders: 0,
        revenue: 0,
        aov: 0,
        deliveryOrders: 0,
        deliveryRevenue: 0,
        inStoreOrders: 0,
        inStoreRevenue: 0,
        deliveryAov: 0,
        inStoreAov: 0,
        ownOrders: null,
        ownRevenue: null,
        ownAov: null,
        aggOrders: null,
        aggRevenue: null,
        aggAov: null,
      } as DaypartAgg);
    const orders = n(c.orders);
    const revenue = n(c.net_sales);
    cur.orders += orders;
    cur.revenue += revenue;
    if (c.channel === "Delivery") {
      cur.deliveryOrders += orders;
      cur.deliveryRevenue += revenue;
    } else if (c.channel === "In-store") {
      cur.inStoreOrders += orders;
      cur.inStoreRevenue += revenue;
    }
    m.set(c.daypart, cur);
  }
  return finalise(Array.from(m.values()), false);
}

function finalise(list: DaypartAgg[], detailed: boolean): DaypartAgg[] {
  return list
    .map((p) => ({
      ...p,
      aov: aov(p.revenue, p.orders),
      deliveryAov: aov(p.deliveryRevenue, p.deliveryOrders),
      inStoreAov: aov(p.inStoreRevenue, p.inStoreOrders),
      ownAov: detailed ? aov(p.ownRevenue ?? 0, p.ownOrders ?? 0) : null,
      aggAov: detailed ? aov(p.aggRevenue ?? 0, p.aggOrders ?? 0) : null,
    }))
    .sort((a, b) => a.rank - b.rank);
}

export default async function DaypartPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores";

  let weekIso: string | null;
  let detailRows: DaypartChannelDetailRow[];
  let basicRows: DaypartChannelRow[];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    [detailRows, basicRows] = await Promise.all([
      getDaypartChannelDetail(weekIso),
      getDaypartChannels(weekIso),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    detailRows = detailRows.filter((c) => c.store === activeStore);
    basicRows = basicRows.filter((c) => c.store === activeStore);
  }

  const hasDetail = detailRows.length > 0;
  const periods = hasDetail ? fromDetail(detailRows) : fromBasic(basicRows);

  if (periods.length === 0) {
    return (
      <>
        <PageTitle title="Daypart Analysis" />
        <EmptyWeek />
      </>
    );
  }

  // Exact values throughout — money to the penny, AOV = revenue ÷ orders.
  const money = (v: number | null) => (v === null ? "—" : gbp(v));
  const count = (v: number | null) => (v === null ? "—" : int(v));

  const dpColumns: Column<DaypartAgg>[] = [
    { key: "dp", header: "Time Period", render: (r) => <span className="font-medium">{r.daypart}</span> },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
    { key: "deliveryAov", header: "AOV — Delivery", align: "right", render: (r) => gbp(r.deliveryAov) },
    { key: "inStoreAov", header: "AOV — In-store", align: "right", render: (r) => gbp(r.inStoreAov) },
    { key: "ownOrders", header: "Own Del — Orders", align: "right", render: (r) => count(r.ownOrders) },
    { key: "ownRevenue", header: "Own Del — Revenue", align: "right", render: (r) => money(r.ownRevenue) },
    { key: "ownAov", header: "Own Del — AOV", align: "right", render: (r) => money(r.ownAov) },
    { key: "aggOrders", header: "Aggregate — Orders", align: "right", render: (r) => count(r.aggOrders) },
    { key: "aggRevenue", header: "Aggregate — Revenue", align: "right", render: (r) => money(r.aggRevenue) },
    { key: "aggAov", header: "Aggregate — AOV", align: "right", render: (r) => money(r.aggAov) },
    { key: "inStoreOrders", header: "In-store — Orders", align: "right", render: (r) => int(r.inStoreOrders) },
    { key: "inStoreRevenue", header: "In-store — Revenue", align: "right", render: (r) => gbp(r.inStoreRevenue) },
    { key: "inStoreAov", header: "In-store — AOV", align: "right", render: (r) => gbp(r.inStoreAov) },
  ];

  const dpChart = periods.map((p) => ({
    period: p.daypart.replace(/\s*\(.*\)/, ""),
    Revenue: Math.round(p.revenue),
    Orders: Math.round(p.orders),
  }));

  const insightInput: DaypartInput = {
    dashboard: "daypart",
    week: weekIso,
    store: activeStore,
    periods: periods.map((p) => ({
      daypart: p.daypart,
      orders: p.orders,
      revenue: p.revenue,
      aov: p.aov,
    })),
  };
  const draft = buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Daypart Analysis"
        subtitle={`Trading patterns across the day (${scopeLabel}) · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <Section
        title="Performance by Time Period"
        description={
          hasDetail
            ? "Orders, revenue and AOV per daypart, with Own Delivery, Aggregate (Deliveroo + Uber Eats + Just Eat) and In-store cuts so each AOV (= revenue ÷ orders) can be verified. Pre-opening orders (before 12:00 Hitchin / 11:30 Stevenage) are excluded."
            : "Orders, revenue and AOV per daypart. Run daypart_channel_views.sql in Supabase to unlock the Own Delivery / Aggregate / Eat-in columns."
        }
      >
        <DataTable columns={dpColumns} rows={periods} />
      </Section>

      <Section title="Trading Patterns">
        <ChartCard title="Revenue by Daypart">
          <BarChartCard
            data={dpChart}
            xKey="period"
            bars={[{ key: "Revenue", name: "Revenue" }]}
            currency
            height={320}
          />
        </ChartCard>
      </Section>
    </div>
  );
}
