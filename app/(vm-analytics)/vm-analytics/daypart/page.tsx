import { getDayparts, getWeekdays, resolveWeek, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, weekRange } from "@/lib/vm-analytics/format";
import { shortStore, STORES } from "@/lib/vm-analytics/constants";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard, LineChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type DaypartInput } from "@/lib/vm-analytics/insights";
import type { DaypartRow, WeekdayRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

interface DaypartAgg {
  daypart: string;
  rank: number;
  orders: number;
  revenue: number;
  aov: number;
}

export default async function DaypartPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  let weekIso: string | null;
  let dayparts: DaypartRow[];
  let weekdays: WeekdayRow[];
  let weekEnd = "";
  try {
    weekIso = await resolveWeek(searchParams.week);
    if (!weekIso) return <EmptyWeek />;
    dayparts = await getDayparts(weekIso);
    weekdays = await getWeekdays(weekIso);
    const weeks = await getWeeks();
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
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
        subtitle={`Trading patterns across the day (both stores) · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <Section
        title="Performance by Time Period"
        description="Orders, revenue and AOV grouped into trading dayparts."
      >
        <DataTable columns={dpColumns} rows={periods} />
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
              lines={STORES.map((s) => ({ key: shortStore(s), name: shortStore(s) }))}
              currency
            />
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}
