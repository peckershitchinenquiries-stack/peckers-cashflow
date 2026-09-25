import {
  getDaypartChannels,
  getDaypartChannelDetail,
  getHourlyActivity,
  getHourlyNetActivity,
  getDailyNetSalesByHour,
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
  HourlyNetActivityRow,
  DailyNetHourRow,
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

// One row per trading hour, rolled up across the scoped store(s). Revenue is
// NET (vm_net_sales_by_hour) and orders come from vm_hourly_order_activity, both
// pre-joined per (store, week, hour) by the vm_v_hourly_net_activity view.
interface HourAgg {
  hour: number;
  orders: number;
  revenue: number;
  aov: number;
}

function aggregateNetHours(rows: HourlyNetActivityRow[]): HourAgg[] {
  const m = new Map<number, HourAgg>();
  for (const r of rows) {
    const hour = Math.trunc(n(r.hour));
    const cur = m.get(hour) ?? { hour, orders: 0, revenue: 0, aov: 0 };
    cur.orders += n(r.orders);
    cur.revenue += n(r.net_sales);
    m.set(hour, cur);
  }
  return Array.from(m.values())
    .map((h) => ({ ...h, aov: aov(h.revenue, h.orders) }))
    .sort((a, b) => a.hour - b.hour);
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const dayIndex = (wd: string) => {
  const p = wd.trim().slice(0, 3).toLowerCase();
  return WEEKDAYS.findIndex((d) => d.toLowerCase().startsWith(p));
};

const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

// Mon=0 .. Sun=6 offset of an ISO date within the week starting `weekStart`.
// -1 when the date falls outside that week.
const addDaysIso = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function dayOffset(weekStart: string, date: string): number {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000,
  );
  return days >= 0 && days <= 6 ? days : -1;
}

// Totals derived by summing the grid. Valid for counts and money only — a ratio
// like AOV cannot be totalled this way (see the note above buildNetHeatmap).
function withTotals(hours: number[], cells: number[][]): HeatmapData {
  const rowTotals = cells.map(sum);
  const colTotals = WEEKDAYS.map((_, di) => cells.reduce((s, row) => s + row[di], 0));
  return {
    hours,
    days: [...WEEKDAYS],
    cells,
    rowTotals,
    colTotals,
    grandTotal: sum(rowTotals),
  };
}

// Both hour × weekday matrices in one pass over vm_hourly_order_activity.
// `orders` (avg_daily_orders) is despite its name an ACTUAL order count — it
// sums exactly to vm_v_daypart_weekday.orders per weekday, so it is safe as an
// AOV denominator. `gross` (avg_daily_sales) is GROSS revenue and is used only
// as the SHAPE for splitting net across weekdays, never displayed.
interface HourGrids {
  hours: number[];
  orders: Map<number, number[]>;
  gross: Map<number, number[]>;
}

function buildHourGrids(rows: HourlyActivityRow[]): HourGrids {
  const orders = new Map<number, number[]>();
  const gross = new Map<number, number[]>();
  for (const r of rows) {
    const di = dayIndex(String(r.weekday));
    if (di < 0) continue;
    const hour = Math.trunc(n(r.order_hour));
    const o = orders.get(hour) ?? new Array(7).fill(0);
    o[di] += n(r.avg_daily_orders);
    orders.set(hour, o);
    const g = gross.get(hour) ?? new Array(7).fill(0);
    g[di] += n(r.avg_daily_sales);
    gross.set(hour, g);
  }
  return { hours: Array.from(orders.keys()).sort((a, b) => a - b), orders, gross };
}

function buildOrderHeatmap(grids: HourGrids): HeatmapData {
  return withTotals(
    grids.hours,
    grids.hours.map((h) => grids.orders.get(h)!.map((v) => Math.round(v)))
  );
}

// Net sales per hour x weekday, read straight from the daily net feed
// (vm_v_daily_net_sales_by_hour) wherever it covers the date — both margins are
// then exact. Coverage starts 2026-03-02, so older weeks, and any day the
// nightly sync missed, still fall back to the old estimate: split that hour's
// week net (vm_net_sales_by_hour, exact) across the uncovered days in
// proportion to their GROSS shape, after subtracting what the exact days
// already account for. Row (hour) totals stay exact either way.
// See docs/DAILY_NET_SALES_READY.md.
function buildNetHeatmap(
  weekStart: string,
  grids: HourGrids,
  netRows: HourlyNetActivityRow[],
  dailyRows: DailyNetHourRow[],
): { data: HeatmapData; exactDays: number } {
  const netByHour = new Map<number, number>();
  for (const r of netRows) {
    const hour = Math.trunc(n(r.hour));
    netByHour.set(hour, (netByHour.get(hour) ?? 0) + n(r.net_sales));
  }

  const exactByHour = new Map<number, number[]>();
  const exactDays = new Set<number>();
  for (const r of dailyRows) {
    const di = dayOffset(weekStart, r.business_date);
    if (di < 0) continue;
    const hour = Math.trunc(n(r.hour));
    const row = exactByHour.get(hour) ?? new Array<number>(7).fill(0);
    row[di] += n(r.net_sales);
    exactByHour.set(hour, row);
    exactDays.add(di);
  }

  const hours = Array.from(new Set([...grids.hours, ...exactByHour.keys()])).sort((a, b) => a - b);
  const fullyExact = exactDays.size === 7;

  const cells = hours.map((h) => {
    const exact = exactByHour.get(h) ?? new Array<number>(7).fill(0);
    if (fullyExact) return exact;

    // Whatever the exact days don't account for is spread over the rest.
    const netHour = Math.max(netByHour.get(h) ?? 0, sum(exact));
    const residual = netHour - sum(exact);
    if (residual <= 0) return exact;

    const blank = (v: number, di: number) => (exactDays.has(di) ? 0 : v);
    let shape = (grids.gross.get(h) ?? new Array<number>(7).fill(0)).map(blank);
    let total = sum(shape);
    if (total <= 0) {
      shape = (grids.orders.get(h) ?? new Array<number>(7).fill(0)).map(blank);
      total = sum(shape);
    }
    if (total <= 0) return exact;
    return exact.map((v, di) => v + (residual * shape[di]) / total);
  });

  return { data: withTotals(hours, cells), exactDays: exactDays.size };
}

// NOTE: an AOV heat map at this grain was built and removed — see Update 34.
// 804 orders across 84 cells averages ~10 per cell, and AOV is a ratio, so most
// cells carried ±£3-4 of sampling noise: the colours read as trading pattern but
// were largely random. Counts and sums (the two grids above) do not have this
// problem. Reliable AOV by hour is in the Performance by Time Period table
// below, which pools all seven days.

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
  let netRows: HourlyNetActivityRow[];
  let dailyNetRows: DailyNetHourRow[];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    [detailRows, basicRows, hourlyRows, netRows, dailyNetRows] = await Promise.all([
      getDaypartChannelDetail(weekIso),
      getDaypartChannels(weekIso),
      getHourlyActivity(weekIso),
      getHourlyNetActivity(weekIso),
      getDailyNetSalesByHour(weekIso, addDaysIso(weekIso, 6)),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    detailRows = detailRows.filter((c) => c.store === activeStore);
    basicRows = basicRows.filter((c) => c.store === activeStore);
    hourlyRows = hourlyRows.filter((c) => c.store === activeStore);
    netRows = netRows.filter((c) => c.store === activeStore);
    // The daily feed keys on the slug, so a store renamed in VM Hub can't
    // silently drop out of this filter.
    const slug = shortStore(activeStore).toLowerCase();
    dailyNetRows = dailyNetRows.filter((r) => r.store_slug?.toLowerCase() === slug);
  }

  const hours = aggregateNetHours(netRows);
  const grids = buildHourGrids(hourlyRows);
  const heatmap = buildOrderHeatmap(grids);
  const { data: netHeatmap, exactDays: netExactDays } = buildNetHeatmap(
    weekIso,
    grids,
    netRows,
    dailyNetRows,
  );
  const netFullyExact = netExactDays === 7;

  // vm_net_sales_by_hour is the row margin of both derived grids, and a gap in
  // it renders as a silent £0 row rather than an error (the backfill shipped
  // after Update 28). Compare what landed in the grid against the raw feed so a
  // shortfall is surfaced instead of read as a genuinely quiet hour.
  const netFeedTotal = netRows.reduce((s, r) => s + n(r.net_sales), 0);
  // Both feeds round each hour to the penny, so a fully exact grid can differ
  // from the week source by a few pence with nothing wrong. Only a real
  // shortfall — a whole hour or day unplaced — is worth flagging.
  const netUnallocated = netFeedTotal - netHeatmap.grandTotal;
  const netDataMissing = netFeedTotal <= 0 && netHeatmap.grandTotal <= 0;

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

  // Hourly "Performance by Time Period" table. Net revenue per hour has no
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
        title="Net Sales Heat Map — Hour × Day"
        description={
          netFullyExact
            ? "Net sales per trading hour by weekday, from the daily net sales feed. Every cell, row and column total is the real figure for that hour on that day."
            : `Net sales per trading hour by weekday. ${netExactDays > 0 ? `${netExactDays} of 7 days come from the daily net sales feed and are exact; the rest are` : "Days are"} estimated by splitting each hour's week total across the remaining days by their sales shape, so those columns are indicative.`
        }
      >
        {netDataMissing ? (
          <div className="vm-table-container px-4 py-8 text-center text-tertiary">
            No hourly net sales data for this week.
          </div>
        ) : (
          <>
            <HourDayHeatmap
              data={netHeatmap}
              formatValue={gbp}
              legendLabel="net sales / hour"
            />
            {netUnallocated > 1 && (
              <p className="mt-2 text-xs text-warning">
                ⚠ {gbp(netUnallocated)} of net sales could not be placed on the grid — those
                hours are missing from the daily feed, so the figures above understate the week.
              </p>
            )}
          </>
        )}
      </Section>

      <Section
        title="Performance by Time Period"
        description="Orders, net revenue and AOV per trading hour (AOV = net revenue ÷ orders). Revenue is net sales — after VAT, service charge and delivery fees — totalled across the week for each hour."
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
