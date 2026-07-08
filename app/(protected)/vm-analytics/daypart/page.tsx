import {
  getDaypartChannels,
  getDaypartChannelDetail,
  getHourlyActivity,
  getWeeks,
} from "@/lib/vm-analytics/queries";
import { n, gbp, int, weekRange } from "@/lib/vm-analytics/format";
import { shortStore, resolveStore } from "@/lib/vm-analytics/constants";
import { Section } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { HourDayHeatmap, type HeatmapData } from "@/components/vm-analytics/HourDayHeatmap";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type DaypartInput } from "@/lib/vm-analytics/insights";
import type {
  DaypartChannelRow,
  DaypartChannelDetailRow,
  HourlyActivityRow,
} from "@/lib/vm-analytics/types";

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

// One row per trading hour, rolled up across the scoped store(s). avg_daily_*
// per (weekday, hour) are summed the same way vm_v_daypart_summary rolls hours
// into dayparts, so the hourly rows reconcile with the daypart totals exactly.
interface HourAgg {
  hour: number;
  orders: number;
  revenue: number;
  aov: number;
}

function aggregateHours(rows: HourlyActivityRow[]): HourAgg[] {
  const m = new Map<number, HourAgg>();
  for (const r of rows) {
    const hour = Math.trunc(n(r.order_hour));
    const cur = m.get(hour) ?? { hour, orders: 0, revenue: 0, aov: 0 };
    cur.orders += n(r.avg_daily_orders);
    cur.revenue += n(r.avg_daily_sales);
    m.set(hour, cur);
  }
  return Array.from(m.values())
    .map((h) => ({ ...h, aov: aov(h.revenue, h.orders) }))
    .sort((a, b) => a.hour - b.hour);
}

// Hour × weekday order-count matrix for the heat map, from the same hourly rows
// that feed the table below. avg_daily_orders is summed per (hour, weekday)
// across the scoped store(s) and rounded to whole orders.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function buildHeatmap(rows: HourlyActivityRow[]): HeatmapData {
  const dayIndex = (wd: string) => {
    const p = wd.trim().slice(0, 3).toLowerCase();
    return WEEKDAYS.findIndex((d) => d.toLowerCase().startsWith(p));
  };
  const byHour = new Map<number, number[]>();
  for (const r of rows) {
    const di = dayIndex(String(r.weekday));
    if (di < 0) continue;
    const hour = Math.trunc(n(r.order_hour));
    const arr = byHour.get(hour) ?? new Array(7).fill(0);
    arr[di] += n(r.avg_daily_orders);
    byHour.set(hour, arr);
  }
  const hours = Array.from(byHour.keys()).sort((a, b) => a - b);
  const cells = hours.map((h) => byHour.get(h)!.map((v) => Math.round(v)));
  const rowTotals = cells.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals = WEEKDAYS.map((_, di) => cells.reduce((s, row) => s + row[di], 0));
  const grandTotal = rowTotals.reduce((s, v) => s + v, 0);
  return { hours, days: [...WEEKDAYS], cells, rowTotals, colTotals, grandTotal };
}

// "17" -> "5pm", "12" -> "12pm", "0" -> "12am". Used to label an hour bucket as
// the window it covers, e.g. hour 11 -> "11am-12pm".
function hour12(h: number): string {
  const period = h >= 12 && h < 24 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}
const hourLabel = (h: number) => `${hour12(h)}-${hour12((h + 1) % 24)}`;

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
  let hourlyRows: HourlyActivityRow[];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    [detailRows, basicRows, hourlyRows] = await Promise.all([
      getDaypartChannelDetail(weekIso),
      getDaypartChannels(weekIso),
      getHourlyActivity(weekIso),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    detailRows = detailRows.filter((c) => c.store === activeStore);
    basicRows = basicRows.filter((c) => c.store === activeStore);
    hourlyRows = hourlyRows.filter((c) => c.store === activeStore);
  }

  const hours = aggregateHours(hourlyRows);
  const heatmap = buildHeatmap(hourlyRows);

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

  // Hourly "Performance by Time Period" table. The raw hourly report has no
  // channel dimension, so this view is Orders / Revenue / AOV only (the
  // Own Delivery / Aggregate / In-store cuts are only defined per daypart).
  const hourColumns: Column<HourAgg>[] = [
    { key: "hour", header: "Time Period", render: (r) => <span className="font-medium">{hourLabel(r.hour)}</span> },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  ];

  // Trading-pattern facts for the commentary, drawn from the same hourly source
  // as the heat map and the table above so the figures reconcile.
  const dayTotals = heatmap.days.map((day, di) => ({ day, orders: heatmap.colTotals[di] }));
  const busiestDay = dayTotals.reduce((a, b) => (b.orders > a.orders ? b : a), dayTotals[0]);
  const quietestDay = dayTotals.reduce((a, b) => (b.orders < a.orders ? b : a), dayTotals[0]);

  let peakCell: { day: string; hourLabel: string; orders: number } | null = null;
  heatmap.cells.forEach((row, ri) => {
    row.forEach((v, ci) => {
      if (!peakCell || v > peakCell.orders) {
        peakCell = { day: heatmap.days[ci], hourLabel: hourLabel(heatmap.hours[ri]), orders: v };
      }
    });
  });

  const insightInput: DaypartInput = {
    dashboard: "daypart",
    week: weekIso,
    store: activeStore,
    hours: hours.map((h) => ({
      label: hourLabel(h.hour),
      orders: h.orders,
      revenue: h.revenue,
      aov: h.aov,
    })),
    heatmap: {
      busiestDay: heatmap.grandTotal > 0 ? busiestDay : null,
      quietestDay: heatmap.grandTotal > 0 ? quietestDay : null,
      peakCell: heatmap.grandTotal > 0 ? peakCell : null,
      totalOrders: heatmap.grandTotal,
    },
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
        title="Order Heat Map — Hour × Day"
        description="Orders per trading hour by weekday (average day's activity). Cells are shaded low→high; the Total column and Total row are shaded on their own scales."
      >
        <HourDayHeatmap data={heatmap} />
      </Section>

      <Section
        title="Performance by Time Period"
        description="Orders, revenue and AOV per trading hour (AOV = revenue ÷ orders). Figures are the average day's activity for that hour, summed across the week — the same basis as the daypart totals, so the hours in a daypart add up to it exactly."
      >
        <DataTable
          columns={hourColumns}
          rows={hours}
          emptyMessage="No hourly activity for this week."
        />
      </Section>

    </div>
  );
}
