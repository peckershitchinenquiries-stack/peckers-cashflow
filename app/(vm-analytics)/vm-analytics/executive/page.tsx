import { getExec, getExecChannels, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange, signedPct } from "@/lib/vm-analytics/format";
import {
  shortStore,
  STORES,
  resolveStore,
  isDeliveryChannel,
  DELIVERY_CHANNELS,
  IN_STORE_CHANNELS,
} from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { ExecRow, ExecChannelRow } from "@/lib/vm-analytics/types";
import type { ExecInput } from "@/lib/vm-analytics/insights";

export const dynamic = "force-dynamic";

const share = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

// Per-channel stats within a fulfilment group (delivery or in-store).
interface ChannelStat {
  channel: string;
  netSales: number;
  orders: number;
  aov: number;
  orderPct: number; // share of orders within the group
  salesPct: number; // share of net sales within the group
}

interface GroupAgg {
  netSales: number;
  orders: number;
  aov: number;
  channels: ChannelStat[];
}

// Aggregated view of a scope (one store, or both combined).
interface Breakdown {
  netSales: number;
  customers: number;
  orders: number; // delivery + in-store orders
  delivery: GroupAgg;
  inStore: GroupAgg;
  aov: number; // blended
}

function groupAgg(rows: ExecChannelRow[], pred: (ch: string) => boolean): GroupAgg {
  const m = new Map<string, { net: number; orders: number }>();
  for (const r of rows) {
    if (!pred(r.channel)) continue;
    const c = m.get(r.channel) ?? { net: 0, orders: 0 };
    c.net += n(r.net_sales);
    c.orders += n(r.orders);
    m.set(r.channel, c);
  }
  let netSales = 0;
  let orders = 0;
  Array.from(m.values()).forEach((c) => {
    netSales += c.net;
    orders += c.orders;
  });
  const channels: ChannelStat[] = Array.from(m.entries())
    .map(([channel, c]) => ({
      channel,
      netSales: c.net,
      orders: c.orders,
      aov: c.orders > 0 ? c.net / c.orders : 0,
      orderPct: share(c.orders, orders),
      salesPct: share(c.net, netSales),
    }))
    .sort((a, b) => b.netSales - a.netSales);
  return { netSales, orders, aov: orders > 0 ? netSales / orders : 0, channels };
}

function buildBreakdown(
  stores: readonly string[],
  execRows: ExecRow[],
  chanRows: ExecChannelRow[]
): Breakdown {
  const scopedExec = execRows.filter((r) => stores.includes(r.store));
  const scopedChan = chanRows.filter((r) => stores.includes(r.store));
  let netSales = 0;
  let customers = 0;
  for (const r of scopedExec) {
    netSales += n(r.net_sales);
    customers += n(r.customer_count);
  }
  const delivery = groupAgg(scopedChan, isDeliveryChannel);
  const inStore = groupAgg(scopedChan, (ch) => !isDeliveryChannel(ch));
  const orders = delivery.orders + inStore.orders;
  return {
    netSales,
    customers,
    orders,
    delivery,
    inStore,
    aov: orders > 0 ? netSales / orders : 0,
  };
}

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const activeStores: readonly string[] = activeStore ? [activeStore] : STORES;

  let weekIso: string | null;
  let rows: ExecRow[];
  let chanRows: ExecChannelRow[];
  let prevRows: ExecRow[] = [];
  let prevChanRows: ExecChannelRow[] = [];
  let weekEnd = "";
  try {
    // One getWeeks() call, then fan out all data fetches in parallel. Keeping the
    // render short reduces event-loop contention (and the chance the concurrent
    // auth fetch in middleware trips its dev-mode timeout).
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

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Executive Dashboard" />
        <EmptyWeek />
      </>
    );
  }

  const scopeLabel = activeStore ? shortStore(activeStore) : "Both stores combined";

  // Breakdowns: one per active store, plus the combined scope and prev week.
  const byStore = new Map<string, Breakdown>();
  for (const s of activeStores) byStore.set(s, buildBreakdown([s], rows, chanRows));
  const combined = buildBreakdown(activeStores, rows, chanRows);
  const hasPrev = prevRows.length > 0;
  const prevCombined = buildBreakdown(activeStores, prevRows, prevChanRows);

  // ---- Headline WoW deltas (scoped to the selected store/s)
  const netWow = hasPrev ? share(combined.netSales - prevCombined.netSales, prevCombined.netSales) : null;
  const ordWow = hasPrev ? share(combined.orders - prevCombined.orders, prevCombined.orders) : null;
  const custWow = hasPrev ? share(combined.customers - prevCombined.customers, prevCombined.customers) : null;
  const aovDelWow =
    hasPrev && prevCombined.delivery.aov > 0
      ? share(combined.delivery.aov - prevCombined.delivery.aov, prevCombined.delivery.aov)
      : null;
  const aovInWow =
    hasPrev && prevCombined.inStore.aov > 0
      ? share(combined.inStore.aov - prevCombined.inStore.aov, prevCombined.inStore.aov)
      : null;
  const netDelWow = hasPrev
    ? share(combined.delivery.netSales - prevCombined.delivery.netSales, prevCombined.delivery.netSales)
    : null;
  const netInWow = hasPrev
    ? share(combined.inStore.netSales - prevCombined.inStore.netSales, prevCombined.inStore.netSales)
    : null;
  const aovBlendWow =
    hasPrev && prevCombined.aov > 0 ? share(combined.aov - prevCombined.aov, prevCombined.aov) : null;

  // Channels actually present (drops e.g. "Order & Pay at Table" when absent).
  const present = (group: "delivery" | "inStore", canonical: readonly string[]) =>
    canonical.filter((ch) =>
      Array.from(byStore.values()).some((b) => b[group].channels.some((c) => c.channel === ch))
    );
  const presentDelivery = present("delivery", DELIVERY_CHANNELS);
  const presentInStore = present("inStore", IN_STORE_CHANNELS);

  // ---- KPI Summary table (per store) -------------------------------------
  type KpiRowDef = {
    kpi: string;
    indent?: boolean;
    cell: (b: Breakdown) => string;
  };

  const channelCell = (group: "delivery" | "inStore", ch: string) => (b: Breakdown) => {
    const c = b[group].channels.find((x) => x.channel === ch);
    return c ? `${int(c.orders)} · ${pct(c.orderPct)}` : "—";
  };

  const kpiRows: KpiRowDef[] = [
    { kpi: "Net Sales", cell: (b) => gbp(b.netSales) },
    { kpi: "Net Sales — Delivery", cell: (b) => gbp(b.delivery.netSales) },
    { kpi: "Net Sales — In-store", cell: (b) => gbp(b.inStore.netSales) },
    { kpi: "Total Orders", cell: (b) => int(b.orders) },
    { kpi: "Customers", cell: (b) => int(b.customers) },
    { kpi: "AOV (Blended)", cell: (b) => gbp(b.aov) },
    { kpi: "AOV — Delivery", cell: (b) => gbp(b.delivery.aov) },
    { kpi: "AOV — In-store", cell: (b) => gbp(b.inStore.aov) },
    {
      kpi: "Delivery Orders",
      cell: (b) => `${int(b.delivery.orders)} · ${pct(share(b.delivery.orders, b.orders))}`,
    },
    ...presentDelivery.map((ch) => ({
      kpi: ch,
      indent: true,
      cell: channelCell("delivery", ch),
    })),
    {
      kpi: "In-store Orders",
      cell: (b) => `${int(b.inStore.orders)} · ${pct(share(b.inStore.orders, b.orders))}`,
    },
    ...presentInStore.map((ch) => ({
      kpi: ch,
      indent: true,
      cell: channelCell("inStore", ch),
    })),
  ];

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
      render: (r: KpiRowDef) => r.cell(byStore.get(s)!),
    })),
    // Total column only adds information when more than one store is shown.
    ...(activeStores.length > 1
      ? [
          {
            key: "total",
            header: "Total",
            align: "right" as const,
            render: (r: KpiRowDef) => <span className="font-semibold">{r.cell(combined)}</span>,
          },
        ]
      : []),
    {
      key: "prev",
      header: "Previous Week",
      align: "right" as const,
      render: (r: KpiRowDef) => (
        <span className="text-tertiary">{hasPrev ? r.cell(prevCombined) : "—"}</span>
      ),
    },
  ];

  // ---- Order-mix tables (per channel, within each group) -----------------
  const mixColumns: Column<ChannelStat>[] = [
    { key: "ch", header: "Channel", render: (r) => <span className="font-medium">{r.channel}</span> },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "pct", header: "% of group", align: "right", render: (r) => pct(r.orderPct) },
    { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  ];

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
  const insightInput: ExecInput = {
    dashboard: "executive",
    week: weekIso,
    totalWow: netWow,
    stores: activeStores.map((s) => {
      const b = byStore.get(s)!;
      const row = rows.find((r) => r.store === s);
      return {
        store: s,
        netSales: b.netSales,
        orders: b.orders,
        aov: b.aov,
        customers: b.customers,
        deliveryPct: share(b.delivery.netSales, b.netSales),
        collectionPct: row ? n(row.collection_pct) : 0,
        eatInPct: row ? n(row.eat_in_pct) : 0,
        netSalesWow: row ? (row.net_sales_wow_pct === null ? null : n(row.net_sales_wow_pct)) : null,
      };
    }),
  };
  const draft = (await import("@/lib/vm-analytics/insights")).buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Executive Dashboard"
        subtitle={`${scopeLabel} · ${weekRange(weekIso, weekEnd)}`}
      />

      <KpiGrid>
        <KpiCard label="Net Sales" value={gbp(combined.netSales)} delta={netWow} />
        <KpiCard label="Net Sales — Delivery" value={gbp(combined.delivery.netSales)} delta={netDelWow} />
        <KpiCard label="Net Sales — In-store" value={gbp(combined.inStore.netSales)} delta={netInWow} />
        <KpiCard label="Total Orders" value={int(combined.orders)} delta={ordWow} />
        <KpiCard
          label="AOV (Blended)"
          value={gbp(combined.aov)}
          delta={aovBlendWow}
          hint="net sales ÷ orders"
        />
        <KpiCard label="AOV — Delivery" value={gbp(combined.delivery.aov)} delta={aovDelWow} />
        <KpiCard label="AOV — In-store" value={gbp(combined.inStore.aov)} delta={aovInWow} />
        <KpiCard label="Customers" value={int(combined.customers)} delta={custWow} />
        <KpiCard label="Delivery %" value={pct(share(combined.delivery.netSales, combined.netSales))} hint="of net sales" />
        <KpiCard label="In-store %" value={pct(share(combined.inStore.netSales, combined.netSales))} hint="of net sales" />
        <KpiCard
          label="Net Sales WoW"
          value={signedPct(netWow)}
          hint={hasPrev ? "vs previous week" : "no prior week"}
        />
      </KpiGrid>

      <Commentary initial={draft} input={insightInput} />

      <Section
        title="Order Mix"
        description="Total orders split into delivery and in-store, with each channel's share of its group."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={`Delivery Orders — ${int(combined.delivery.orders)} (${pct(
              share(combined.delivery.orders, combined.orders)
            )} of orders)`}
          >
            <DataTable columns={mixColumns} rows={combined.delivery.channels} />
            {deliveryOrdersChart.length > 0 && (
              <div className="mt-4">
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
            <DataTable columns={mixColumns} rows={combined.inStore.channels} />
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
        description={
          activeStore
            ? `${shortStore(activeStore)} only, with previous-week values.`
            : "Both stores side by side, with combined totals and previous-week values."
        }
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
