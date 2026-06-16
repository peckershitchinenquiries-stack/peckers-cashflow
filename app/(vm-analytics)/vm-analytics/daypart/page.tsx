import {
  getDayparts,
  getWeekdays,
  getLunchDeals,
  getLunchDealsChannel,
  getLunchDealsChannelDetail,
  getWeeks,
} from "@/lib/vm-analytics/queries";
import { n, gbp, int, weekRange } from "@/lib/vm-analytics/format";
import { shortStore, STORES, resolveStore } from "@/lib/vm-analytics/constants";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard, LineChartCard, PieChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type DaypartInput } from "@/lib/vm-analytics/insights";
import type {
  DaypartRow,
  WeekdayRow,
  LunchDealItemRow,
  LunchDealChannelRow,
  LunchDealChannelDetailRow,
} from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

interface DaypartAgg {
  daypart: string;
  rank: number;
  orders: number;
  revenue: number;
  aov: number;
}

interface DealAgg {
  deal: string;
  sold: number;
  revenue: number;
  aov: number;
}

interface StoreDealTotals {
  store: string;
  sold: number;
  revenue: number;
  aov: number;
}

interface DealChannelRow {
  store: string;
  channel: "Delivery" | "In-store";
  orders: number;
  revenue: number;
  aov: number;
}

export default async function DaypartPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const activeStores = activeStore ? [activeStore] : [...STORES];
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores";

  let weekIso: string | null;
  let dayparts: DaypartRow[];
  let weekdays: WeekdayRow[];
  let lunchDeals: LunchDealItemRow[];
  let lunchChannels: LunchDealChannelRow[];
  let lunchChannelDetail: LunchDealChannelDetailRow[];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    [dayparts, weekdays, lunchDeals, lunchChannels, lunchChannelDetail] = await Promise.all([
      getDayparts(weekIso),
      getWeekdays(weekIso),
      getLunchDeals(weekIso),
      getLunchDealsChannel(weekIso),
      getLunchDealsChannelDetail(weekIso),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    dayparts = dayparts.filter((d) => d.store === activeStore);
    weekdays = weekdays.filter((w) => w.store === activeStore);
    lunchDeals = lunchDeals.filter((d) => d.store === activeStore);
    lunchChannels = lunchChannels.filter((c) => c.store === activeStore);
    lunchChannelDetail = lunchChannelDetail.filter((c) => c.store === activeStore);
  }

  if (dayparts.length === 0) {
    return (
      <>
        <PageTitle title="Daypart Analysis" />
        <EmptyWeek />
      </>
    );
  }

  const dpMap = new Map<string, DaypartAgg>();
  for (const d of dayparts) {
    const cur =
      dpMap.get(d.daypart) ??
      { daypart: d.daypart, rank: d.daypart_rank, orders: 0, revenue: 0, aov: 0 };
    cur.orders += n(d.orders);
    cur.revenue += n(d.revenue);
    dpMap.set(d.daypart, cur);
  }
  const periods = Array.from(dpMap.values())
    .map((p) => ({ ...p, aov: p.orders > 0 ? p.revenue / p.orders : 0 }))
    .sort((a, b) => a.rank - b.rank);

  const dpColumns: Column<DaypartAgg>[] = [
    { key: "dp", header: "Time Period", render: (r) => <span className="font-medium">{r.daypart}</span> },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  ];

  const dpChart = periods.map((p) => ({
    period: p.daypart.replace(/\s*\(.*\)/, ""),
    Revenue: Math.round(p.revenue),
    Orders: Math.round(p.orders),
  }));

  const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const wdMap = new Map<string, Record<string, number | string>>();
  for (const w of weekdays) {
    const row = wdMap.get(w.weekday) ?? { weekday: w.weekday.slice(0, 3) };
    row[shortStore(w.store)] = Math.round(n(w.revenue));
    wdMap.set(w.weekday, row);
  }
  const weekdayChart = weekdayOrder
    .filter((d) => wdMap.has(d))
    .map((d) => wdMap.get(d)!);

  // ---- Lunch Time Deals (meal deals sold) --------------------------------
  // Per-deal totals across the scoped store(s).
  const dealMap = new Map<string, DealAgg>();
  // Per-store totals so "All Stores" can show each store side by side.
  const storeDealMap = new Map<string, StoreDealTotals>();
  for (const d of lunchDeals) {
    const name = (d.meal_deal_name ?? "").trim();
    if (!name) continue;
    const sold = n(d.no_of_meal_deals);
    const rev = n(d.net_sales);

    const cur = dealMap.get(name) ?? { deal: name, sold: 0, revenue: 0, aov: 0 };
    cur.sold += sold;
    cur.revenue += rev;
    dealMap.set(name, cur);

    const st = storeDealMap.get(d.store) ?? { store: d.store, sold: 0, revenue: 0, aov: 0 };
    st.sold += sold;
    st.revenue += rev;
    storeDealMap.set(d.store, st);
  }
  const deals = Array.from(dealMap.values())
    .map((c) => ({ ...c, aov: c.sold > 0 ? c.revenue / c.sold : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const storeDealTotals = activeStores
    .map((s) => storeDealMap.get(s))
    .filter((x): x is StoreDealTotals => !!x)
    .map((t) => ({ ...t, aov: t.sold > 0 ? t.revenue / t.sold : 0 }));

  const dealsSold = deals.reduce((s, d) => s + d.sold, 0);
  const dealsRevenue = deals.reduce((s, d) => s + d.revenue, 0);
  const dealsAov = dealsSold > 0 ? dealsRevenue / dealsSold : 0;

  const dealColumns: Column<DealAgg>[] = [
    { key: "deal", header: "Meal Deal", render: (r) => <span className="font-medium">{r.deal}</span> },
    { key: "sold", header: "Sold", align: "right", render: (r) => int(r.sold) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  ];

  const storeDealColumns: Column<StoreDealTotals>[] = [
    { key: "store", header: "Store", render: (r) => <span className="font-medium">{shortStore(r.store)}</span> },
    { key: "sold", header: "Meal Deals Sold", align: "right", render: (r) => int(r.sold) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  ];

  const dealChart = deals
    .slice(0, 8)
    .map((d) => ({ deal: d.deal.replace(/\s+meal( deal| box)?$/i, ""), Revenue: Math.round(d.revenue) }));

  // Delivery vs in-store split (from vm_v_lunch_deals_channel). One row per
  // (store, channel); build a per-store × channel table plus scoped AOV totals.
  const channelRows: DealChannelRow[] = [];
  const chTotals = {
    delivery: { orders: 0, revenue: 0 },
    in_store: { orders: 0, revenue: 0 },
  };
  for (const s of activeStores) {
    for (const key of ["delivery", "in_store"] as const) {
      const row = lunchChannels.find((c) => c.store === s && c.channel === key);
      const orders = row ? n(row.deal_baskets) : 0;
      const revenue = row ? n(row.net_sales) : 0;
      if (orders === 0 && revenue === 0) continue;
      channelRows.push({
        store: s,
        channel: key === "delivery" ? "Delivery" : "In-store",
        orders,
        revenue,
        aov: orders > 0 ? revenue / orders : 0,
      });
      chTotals[key].orders += orders;
      chTotals[key].revenue += revenue;
    }
  }
  const aovDelivery = chTotals.delivery.orders > 0 ? chTotals.delivery.revenue / chTotals.delivery.orders : 0;
  const aovInStore = chTotals.in_store.orders > 0 ? chTotals.in_store.revenue / chTotals.in_store.orders : 0;
  const hasChannelSplit = channelRows.length > 0;

  const dealChannelColumns: Column<DealChannelRow>[] = [
    { key: "store", header: "Store", render: (r) => <span className="font-medium">{shortStore(r.store)}</span> },
    { key: "channel", header: "Fulfilment", render: (r) => r.channel },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  ];

  // Per-store channel mix for the pie charts: each slice is an individual
  // channel, labelled with its share of that store's meal-deal orders.
  const channelMixByStore = activeStores
    .map((store) => {
      const rows = lunchChannelDetail.filter((c) => c.store === store);
      const total = rows.reduce((s, r) => s + n(r.deal_baskets), 0);
      const data = rows
        .map((r) => ({ channel: r.channel_name, orders: n(r.deal_baskets) }))
        .filter((d) => d.orders > 0)
        .sort((a, b) => b.orders - a.orders)
        .map((d) => ({
          name: `${d.channel} (${total > 0 ? Math.round((100 * d.orders) / total) : 0}%)`,
          value: d.orders,
        }));
      return { store, total, data };
    })
    .filter((s) => s.data.length > 0);
  const hasChannelMix = channelMixByStore.length > 0;

  const insightInput: DaypartInput = {
    dashboard: "daypart",
    week: weekIso,
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
        description="Orders, revenue and AOV grouped into trading dayparts."
      >
        <DataTable columns={dpColumns} rows={periods} />
      </Section>

      <Section
        title="Lunch Time Deals"
        description={`Meal deal performance (${scopeLabel}) — orders, revenue and AOV.`}
      >
        {deals.length === 0 ? (
          <div className="vm-card p-4 text-sm text-secondary">
            No meal deal data for this week. Sync the “Meal Deals Sold (table) (weekly)” report.
          </div>
        ) : (
          <div className="space-y-4">
            <KpiGrid>
              <KpiCard label="Meal Deals Sold" value={int(dealsSold)} hint={scopeLabel} />
              <KpiCard label="Meal Deal Revenue" value={gbp(dealsRevenue)} hint={scopeLabel} />
              <KpiCard label="Meal Deal AOV" value={gbp(dealsAov)} hint="revenue ÷ deals" />
              {hasChannelSplit && (
                <>
                  <KpiCard label="AOV — Delivery" value={gbp(aovDelivery)} hint="meal deals" />
                  <KpiCard label="AOV — In-store" value={gbp(aovInStore)} hint="meal deals" />
                </>
              )}
            </KpiGrid>

            {storeDealTotals.length > 1 && (
              <DataTable columns={storeDealColumns} rows={storeDealTotals} caption="By store" />
            )}

            {hasChannelSplit && (
              <DataTable
                columns={dealChannelColumns}
                rows={channelRows}
                caption="Delivery vs in-store (orders, revenue, AOV)"
              />
            )}

            {hasChannelMix && (
              <div className="grid gap-4 lg:grid-cols-2">
                {channelMixByStore.map((s) => (
                  <ChartCard key={s.store} title={`Channel mix — ${shortStore(s.store)}`}>
                    <PieChartCard data={s.data} nameKey="name" valueKey="value" currency={false} />
                  </ChartCard>
                ))}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <DataTable columns={dealColumns} rows={deals} caption="Meal deals by revenue" />
              <ChartCard title="Top meal deals by revenue">
                <BarChartCard
                  data={dealChart}
                  xKey="deal"
                  bars={[{ key: "Revenue", name: "Revenue" }]}
                  currency
                  height={320}
                />
              </ChartCard>
            </div>
          </div>
        )}
      </Section>

      <Section title="Trading Patterns">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Revenue by Daypart">
            <BarChartCard
              data={dpChart}
              xKey="period"
              bars={[{ key: "Revenue", name: "Revenue" }]}
              currency
            />
          </ChartCard>
          <ChartCard title="Revenue by Weekday (per store)">
            <LineChartCard
              data={weekdayChart}
              xKey="weekday"
              lines={activeStores.map((s) => ({ key: shortStore(s), name: shortStore(s) }))}
              currency
            />
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}
