import { getDelivery, resolveWeek, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard, PieChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type DeliveryInput } from "@/lib/vm-analytics/insights";
import type { DeliveryRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

interface ChannelAgg {
  platform: string;
  orders: number;
  revenue: number;
  aov: number;
  sharePct: number;
  wow: number | null;
}

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  let weekIso: string | null;
  let rows: DeliveryRow[];
  let weekEnd = "";
  try {
    weekIso = await resolveWeek(searchParams.week);
    if (!weekIso) return <EmptyWeek />;
    rows = await getDelivery(weekIso);
    const weeks = await getWeeks();
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Delivery Platform Performance" />
        <EmptyWeek />
      </>
    );
  }

  const map = new Map<string, { platform: string; orders: number; revenue: number; net: number; wowParts: number[] }>();
  for (const r of rows) {
    const cur =
      map.get(r.platform) ??
      { platform: r.platform, orders: 0, revenue: 0, net: 0, wowParts: [] as number[] };
    cur.orders += n(r.orders);
    cur.revenue += n(r.gross_sales);
    cur.net += n(r.net_sales);
    if (r.gross_sales_wow_pct !== null && r.gross_sales_wow_pct !== undefined)
      cur.wowParts.push(n(r.gross_sales_wow_pct));
    map.set(r.platform, cur);
  }
  const totalRevenue = Array.from(map.values()).reduce((s, c) => s + c.revenue, 0);
  const channels: ChannelAgg[] = Array.from(map.values())
    .map((c) => ({
      platform: c.platform,
      orders: c.orders,
      revenue: c.revenue,
      aov: c.orders > 0 ? c.revenue / c.orders : 0,
      sharePct: totalRevenue > 0 ? (100 * c.revenue) / totalRevenue : 0,
      wow: c.wowParts.length ? c.wowParts.reduce((a, b) => a + b, 0) / c.wowParts.length : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const columns: Column<ChannelAgg>[] = [
    { key: "ch", header: "Channel", render: (r) => <span className="font-medium">{r.platform}</span> },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "share", header: "Share", align: "right", render: (r) => pct(r.sharePct) },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
    {
      key: "wow",
      header: "Revenue WoW",
      align: "right",
      render: (r) => <span className={deltaClass(r.wow)}>{signedPct(r.wow)}</span>,
    },
  ];

  const revChart = channels.map((c) => ({ channel: c.platform, Revenue: Math.round(c.revenue) }));
  const pieData = channels.map((c) => ({ name: c.platform, value: Math.round(c.revenue) }));

  const insightInput: DeliveryInput = {
    dashboard: "delivery",
    week: weekIso,
    channels: channels.map((c) => ({
      platform: c.platform,
      revenue: c.revenue,
      orders: c.orders,
      aov: c.aov,
      sharePct: c.sharePct,
      wow: c.wow,
    })),
  };
  const draft = buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Delivery Platform Performance"
        subtitle={`Performance by ordering channel (both stores) · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <Section
        title="Channel Breakdown"
        description="Revenue, orders and AOV per ordering channel."
      >
        <DataTable columns={columns} rows={channels} />
      </Section>

      <Section title="Channel Mix">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Revenue by Channel">
            <BarChartCard
              data={revChart}
              xKey="channel"
              bars={[{ key: "Revenue", name: "Revenue" }]}
              currency
            />
          </ChartCard>
          <ChartCard title="Revenue Share">
            <PieChartCard data={pieData} nameKey="name" valueKey="value" />
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}
