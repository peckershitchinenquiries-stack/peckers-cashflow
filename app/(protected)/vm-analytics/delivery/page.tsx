import { getExec, getExecChannels, getWeeks } from "@/lib/vm-analytics/queries";
import { gbp, int, pct, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import { resolveStore, shortStore, STORES } from "@/lib/vm-analytics/constants";
import {
  share,
  buildBreakdown,
  ownDelivery,
  aggregator,
  type Breakdown,
} from "@/lib/vm-analytics/channels";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { PieChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type DeliveryInput } from "@/lib/vm-analytics/insights";
import type { ExecRow, ExecChannelRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

// A row in the hierarchical channel-breakdown table. `level` controls the
// indent: 0 = group (In-store / Delivery), 1 = sub-group (Own Delivery /
// Aggregate / in-store channels), 2 = aggregator platform (Uber/Deliveroo/JE).
interface Row {
  label: string;
  level: number;
  bold: boolean;
  netSales: number;
  orders: number;
  aov: number;
  sharePct: number;
  wow: number | null;
}

// Share of the (channel-based) total net sales, so every row — group, sub-group
// and leaf — is comparable on the same denominator and the groups add to 100%.
function wowOf(cur: number, prev: number, hasPrev: boolean): number | null {
  if (!hasPrev || prev <= 0) return null;
  return share(cur - prev, prev);
}

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const activeStores: readonly string[] = activeStore ? [activeStore] : STORES;
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores combined";

  let weekIso: string | null;
  let rows: ExecRow[];
  let chanRows: ExecChannelRow[];
  let prevRows: ExecRow[] = [];
  let prevChanRows: ExecChannelRow[] = [];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
    const prevIso = idx >= 0 ? weeks[idx + 1]?.week_start_iso ?? null : null;
    [rows, chanRows, prevRows, prevChanRows] = await Promise.all([
      getExec(weekIso),
      getExecChannels(weekIso),
      prevIso ? getExec(prevIso) : Promise.resolve<ExecRow[]>([]),
      prevIso ? getExecChannels(prevIso) : Promise.resolve<ExecChannelRow[]>([]),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (chanRows.length === 0) {
    return (
      <>
        <PageTitle title="Delivery Platform Performance" />
        <EmptyWeek />
      </>
    );
  }

  const hasPrev = prevRows.length > 0;
  const combined = buildBreakdown(activeStores, rows, chanRows);
  const prevCombined = buildBreakdown(activeStores, prevRows, prevChanRows);

  // Channel-based total net sales (delivery + in-store) — the denominator for
  // every Share %. Net sales is used throughout so the figures reconcile with
  // the Executive dashboard.
  const totalNet = combined.delivery.netSales + combined.inStore.netSales;

  // Build the ordered, indented rows for one scope's breakdown.
  const buildRows = (b: Breakdown, prev: Breakdown): Row[] => {
    const prevInStore = new Map(prev.inStore.channels.map((c) => [c.channel, c]));
    const prevDelivery = new Map(prev.delivery.channels.map((c) => [c.channel, c]));
    const denom = b.delivery.netSales + b.inStore.netSales;
    const sharePct = (net: number) => (denom > 0 ? (100 * net) / denom : 0);

    const own = ownDelivery(b.delivery);
    const agg = aggregator(b.delivery);
    const prevOwn = ownDelivery(prev.delivery);
    const prevAgg = aggregator(prev.delivery);

    const out: Row[] = [];

    // ---- In-store group ----
    out.push({
      label: "In-store",
      level: 0,
      bold: true,
      netSales: b.inStore.netSales,
      orders: b.inStore.orders,
      aov: b.inStore.aov,
      sharePct: sharePct(b.inStore.netSales),
      wow: wowOf(b.inStore.netSales, prev.inStore.netSales, hasPrev),
    });
    for (const c of b.inStore.channels) {
      const p = prevInStore.get(c.channel);
      out.push({
        label: c.channel,
        level: 1,
        bold: false,
        netSales: c.netSales,
        orders: c.orders,
        aov: c.aov,
        sharePct: sharePct(c.netSales),
        wow: wowOf(c.netSales, p ? p.netSales : 0, hasPrev),
      });
    }

    // ---- Delivery group ----
    out.push({
      label: "Delivery",
      level: 0,
      bold: true,
      netSales: b.delivery.netSales,
      orders: b.delivery.orders,
      aov: b.delivery.aov,
      sharePct: sharePct(b.delivery.netSales),
      wow: wowOf(b.delivery.netSales, prev.delivery.netSales, hasPrev),
    });
    // Own Delivery
    out.push({
      label: "Own Delivery",
      level: 1,
      bold: false,
      netSales: own.netSales,
      orders: own.orders,
      aov: own.aov,
      sharePct: sharePct(own.netSales),
      wow: wowOf(own.netSales, prevOwn.netSales, hasPrev),
    });
    // Aggregate (sub-total) + its platforms
    out.push({
      label: "Aggregate",
      level: 1,
      bold: true,
      netSales: agg.netSales,
      orders: agg.orders,
      aov: agg.aov,
      sharePct: sharePct(agg.netSales),
      wow: wowOf(agg.netSales, prevAgg.netSales, hasPrev),
    });
    for (const c of b.delivery.channels.filter((x) => /deliveroo|uber|just\s*eat/i.test(x.channel))) {
      const p = prevDelivery.get(c.channel);
      out.push({
        label: c.channel,
        level: 2,
        bold: false,
        netSales: c.netSales,
        orders: c.orders,
        aov: c.aov,
        sharePct: sharePct(c.netSales),
        wow: wowOf(c.netSales, p ? p.netSales : 0, hasPrev),
      });
    }
    return out;
  };

  const breakdownRows = buildRows(combined, prevCombined);

  const columns: Column<Row>[] = [
    {
      key: "ch",
      header: "Channel",
      render: (r) => (
        <span
          className={r.bold ? "font-semibold" : ""}
          style={{ paddingLeft: r.level * 16 }}
        >
          {r.label}
        </span>
      ),
    },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.netSales) },
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

  // Revenue-share pie: just the three headline groups, shown as % of net sales.
  const threeWayPie = (b: Breakdown) => [
    { name: "In-store", value: b.inStore.netSales },
    { name: "Own Delivery", value: ownDelivery(b.delivery).netSales },
    { name: "Aggregate", value: aggregator(b.delivery).netSales },
  ];

  // Commentary still reads from the leaf channels (net sales based).
  const leafChannels = [
    ...combined.delivery.channels,
    ...combined.inStore.channels,
  ]
    .map((c) => ({
      platform: c.channel,
      revenue: c.netSales,
      orders: c.orders,
      aov: c.aov,
      sharePct: totalNet > 0 ? (100 * c.netSales) / totalNet : 0,
      wow: null as number | null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const insightInput: DeliveryInput = {
    dashboard: "delivery",
    week: weekIso,
    store: activeStore,
    channels: leafChannels,
  };
  const draft = buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Delivery Platform Performance"
        subtitle={`Performance by ordering channel (${scopeLabel}) · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <Section
        title="Channel Breakdown"
        description="Net sales, orders and AOV per channel. In-store and Delivery are split into their sub-channels; Aggregate = Deliveroo + Uber Eats + Just Eat. Figures reconcile with the Executive dashboard."
      >
        <DataTable columns={columns} rows={breakdownRows} />
      </Section>

      <Section title="Revenue Share">
        <ChartCard title={`Revenue Share — ${scopeLabel}`}>
          <PieChartCard
            data={threeWayPie(combined)}
            nameKey="name"
            valueKey="value"
            showPercent
          />
        </ChartCard>
      </Section>
    </div>
  );
}
