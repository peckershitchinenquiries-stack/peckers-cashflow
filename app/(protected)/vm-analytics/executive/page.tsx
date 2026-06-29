import { getExec, getExecChannels, getWeeks, getYoy, yoyWeekIso } from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import {
  shortStore,
  STORES,
  resolveStore,
  DELIVERY_CHANNELS,
  IN_STORE_CHANNELS,
} from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { ExecRow, ExecChannelRow, YoyRow } from "@/lib/vm-analytics/types";
import type { ExecInput } from "@/lib/vm-analytics/insights";
import { share, buildBreakdown, ownDelivery, aggregator, type Breakdown, type ChannelStat, type GroupAgg } from "@/lib/vm-analytics/channels";

export const dynamic = "force-dynamic";

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
  let yoyRow: YoyRow | null = null;
  let yoyWeek = "";
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
    yoyWeek = yoyWeekIso(weekIso);

    [rows, chanRows, prevRows, prevChanRows, yoyRow] = await Promise.all([
      getExec(weekIso),
      getExecChannels(weekIso),
      prevIso ? getExec(prevIso) : Promise.resolve<ExecRow[]>([]),
      prevIso ? getExecChannels(prevIso) : Promise.resolve<ExecChannelRow[]>([]),
      getYoy(weekIso, activeStore),
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
  const prevByStore = new Map<string, Breakdown>();
  if (hasPrev) {
    for (const s of activeStores) prevByStore.set(s, buildBreakdown([s], prevRows, prevChanRows));
  }

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

  // Own Delivery vs Aggregator (Deliveroo + Uber Eats + Just Eat) — both net
  // sales and AOV (net ÷ orders), with WoW vs the previous week.
  const ownDel = ownDelivery(combined.delivery);
  const aggDel = aggregator(combined.delivery);
  const prevOwnDel = ownDelivery(prevCombined.delivery);
  const prevAggDel = aggregator(prevCombined.delivery);
  const netOwnWow =
    hasPrev && prevOwnDel.netSales > 0 ? share(ownDel.netSales - prevOwnDel.netSales, prevOwnDel.netSales) : null;
  const netAggWow =
    hasPrev && prevAggDel.netSales > 0 ? share(aggDel.netSales - prevAggDel.netSales, prevAggDel.netSales) : null;
  const aovOwnWow =
    hasPrev && prevOwnDel.aov > 0 ? share(ownDel.aov - prevOwnDel.aov, prevOwnDel.aov) : null;
  const aovAggWow =
    hasPrev && prevAggDel.aov > 0 ? share(aggDel.aov - prevAggDel.aov, prevAggDel.aov) : null;

  // ---- YoY deltas (from historical Excel data) ----------------------------
  const hasYoy = yoyRow !== null;
  const yoyTotalSales    = yoyRow ? n(yoyRow.total_sales)         : 0;
  const yoyDeliverySales = yoyRow ? n(yoyRow.delivery_sales)      : 0;
  const yoyInStoreSales  = yoyRow ? n(yoyRow.in_store_sales)      : 0;
  const yoyOwnDelivery   = yoyRow ? n(yoyRow.own_delivery_sales)  : 0;
  const yoyAggregate     = yoyRow ? n(yoyRow.aggregate_sales)     : 0;

  const netYoy    = hasYoy && yoyTotalSales    > 0 ? share(combined.netSales           - yoyTotalSales,    yoyTotalSales)    : null;
  const delYoy    = hasYoy && yoyDeliverySales > 0 ? share(combined.delivery.netSales  - yoyDeliverySales, yoyDeliverySales) : null;
  const inStYoy   = hasYoy && yoyInStoreSales  > 0 ? share(combined.inStore.netSales   - yoyInStoreSales,  yoyInStoreSales)  : null;
  const ownDelYoy = hasYoy && yoyOwnDelivery   > 0 ? share(ownDel.netSales             - yoyOwnDelivery,   yoyOwnDelivery)   : null;
  const aggYoy    = hasYoy && yoyAggregate     > 0 ? share(aggDel.netSales             - yoyAggregate,     yoyAggregate)     : null;

  // YoY deltas for orders and customers (from EPOS data)
  const yoyTotalOrders    = yoyRow ? n(yoyRow.total_orders)    : 0;
  const yoyTotalCustomers = yoyRow ? n(yoyRow.total_customers)  : 0;

  const ordYoy  = hasYoy && yoyTotalOrders    > 0 ? share(combined.orders     - yoyTotalOrders,    yoyTotalOrders)    : null;
  const custYoy = hasYoy && yoyTotalCustomers > 0 ? share(combined.customers  - yoyTotalCustomers, yoyTotalCustomers) : null;

  const yoyPctMap: Record<string, number | null> = {
    "Net Sales": netYoy,
    "Net Sales — Delivery": delYoy,
    "Net Sales — Own Delivery": ownDelYoy,
    "Net Sales — Aggregator": aggYoy,
    "Net Sales — In-store": inStYoy,
  };

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
    // Semantic colour: "good" (green) for in-store / own delivery, "bad" (red)
    // for aggregator. Drives the value colour in every store column.
    tone?: "good" | "bad";
    cell: (b: Breakdown) => string;
  };

  // Every channel % is now share of the STORE's net sales (channel net ÷ store
  // net), NOT share of its group — so Own Delivery % here matches the Delivery
  // and other dashboards exactly. (pct truncates, so it never rounds up.)
  const channelCell = (group: "delivery" | "inStore", ch: string) => (b: Breakdown) => {
    const c = b[group].channels.find((x) => x.channel === ch);
    if (!c) return "—";
    const storeShare = b.netSales > 0 ? (100 * c.netSales) / b.netSales : 0;
    return `${int(c.orders)} · ${pct(storeShare)}`;
  };

  const kpiRows: KpiRowDef[] = [
    { kpi: "Net Sales", cell: (b) => gbp(b.netSales) },
    { kpi: "Net Sales — Delivery", cell: (b) => gbp(b.delivery.netSales) },
    { kpi: "Net Sales — Own Delivery", indent: true, tone: "good", cell: (b) => gbp(ownDelivery(b.delivery).netSales) },
    { kpi: "Net Sales — Aggregator", indent: true, tone: "bad", cell: (b) => gbp(aggregator(b.delivery).netSales) },
    { kpi: "Net Sales — In-store", tone: "good", cell: (b) => gbp(b.inStore.netSales) },
    { kpi: "Total Orders", cell: (b) => int(b.orders) },
    { kpi: "Customers", cell: (b) => int(b.customers) },
    { kpi: "AOV (Blended)", cell: (b) => gbp(b.aov) },
    { kpi: "AOV — Delivery", cell: (b) => gbp(b.delivery.aov) },
    { kpi: "AOV — Own Delivery", indent: true, tone: "good", cell: (b) => gbp(ownDelivery(b.delivery).aov) },
    { kpi: "AOV — Aggregator", indent: true, tone: "bad", cell: (b) => gbp(aggregator(b.delivery).aov) },
    { kpi: "AOV — In-store", tone: "good", cell: (b) => gbp(b.inStore.aov) },
    {
      kpi: "Delivery Orders",
      cell: (b) => `${int(b.delivery.orders)} · ${pct(b.deliveryPct)}`,
    },
    ...presentDelivery.map((ch): KpiRowDef => ({
      kpi: ch,
      indent: true,
      tone: /own|direct/i.test(ch) ? "good" : /deliveroo|uber|just\s*eat/i.test(ch) ? "bad" : undefined,
      cell: channelCell("delivery", ch),
    })),
    {
      kpi: "In-store Orders",
      tone: "good",
      cell: (b) => `${int(b.inStore.orders)} · ${pct(b.inStorePct)}`,
    },
    ...presentInStore.map((ch): KpiRowDef => ({
      kpi: ch,
      indent: true,
      tone: "good",
      cell: channelCell("inStore", ch),
    })),
  ];

  // Green for margin-friendly rows (in-store / own delivery), red for aggregator.
  const toneClass = (tone?: "good" | "bad") =>
    tone === "good"
      ? "text-success"
      : tone === "bad"
      ? "text-danger"
      : "";

  const getYoyCellValue = (kpiLabel: string, yoy: YoyRow | null): string => {
    if (!yoy) return "—";

    // Derived channel groups from the new EPOS order-count columns
    const yoyOwnDel  = n(yoy.own_delivery);
    const yoyDel     = n(yoy.deliveroo) + n(yoy.just_eat) + n(yoy.uber_eats);
    const yoyDelAll  = yoyOwnDel + yoyDel;
    const yoyIns     = n(yoy.click_collect) + n(yoy.kiosk) + n(yoy.till_eat_in) + n(yoy.till_takeaway);
    const yoyTotOrd  = n(yoy.total_orders) || (yoyDelAll + yoyIns);

    switch (kpiLabel) {
      // ── Net Sales (already populated) ──────────────────────────────────────
      case "Net Sales":                return gbp(n(yoy.total_sales));
      case "Net Sales — Delivery":     return gbp(n(yoy.delivery_sales));
      case "Net Sales — Own Delivery": return gbp(n(yoy.own_delivery_sales));
      case "Net Sales — Aggregator":   return gbp(n(yoy.aggregate_sales));
      case "Net Sales — In-store":     return gbp(n(yoy.in_store_sales));

      // ── Orders & Customers (new EPOS columns) ──────────────────────────────
      case "Total Orders": return yoyTotOrd > 0 ? int(yoyTotOrd) : "—";
      case "Customers":    return n(yoy.total_customers) > 0 ? int(n(yoy.total_customers)) : "—";

      // ── AOV (derived from sales ÷ orders) ──────────────────────────────────
      case "AOV (Blended)":
        return yoyTotOrd > 0 && n(yoy.total_sales) > 0
          ? gbp(n(yoy.total_sales) / yoyTotOrd)
          : "—";
      case "AOV — Delivery":
        return yoyDelAll > 0 && n(yoy.delivery_sales) > 0
          ? gbp(n(yoy.delivery_sales) / yoyDelAll)
          : "—";
      case "AOV — Own Delivery":
        return yoyOwnDel > 0 && n(yoy.own_delivery_sales) > 0
          ? gbp(n(yoy.own_delivery_sales) / yoyOwnDel)
          : "—";
      case "AOV — Aggregator":
        return yoyDel > 0 && n(yoy.aggregate_sales) > 0
          ? gbp(n(yoy.aggregate_sales) / yoyDel)
          : "—";
      case "AOV — In-store":
        return yoyIns > 0 && n(yoy.in_store_sales) > 0
          ? gbp(n(yoy.in_store_sales) / yoyIns)
          : "—";

      // ── Delivery channel order counts ──────────────────────────────────────
      case "Delivery Orders":
        return yoyDelAll > 0
          ? `${int(yoyDelAll)} · ${pct(n(yoy.delivery_pct))}`
          : "—";
      case "Own Delivery":
        return yoyOwnDel > 0
          ? `${int(yoyOwnDel)} · ${pct(n(yoy.own_delivery_pct))}`
          : "—";
      case "Deliveroo":
        return n(yoy.deliveroo) > 0 ? int(n(yoy.deliveroo)) : "—";
      case "Uber Eats":
        return n(yoy.uber_eats) > 0 ? int(n(yoy.uber_eats)) : "—";
      case "Just Eat":
        return n(yoy.just_eat) > 0 ? int(n(yoy.just_eat)) : "—";

      // ── In-store channel order counts ──────────────────────────────────────
      case "In-store Orders":
        return yoyIns > 0
          ? `${int(yoyIns)} · ${pct(n(yoy.in_store_pct))}`
          : "—";
      case "Click & Collect":
        return n(yoy.click_collect) > 0 ? int(n(yoy.click_collect)) : "—";
      case "Kiosk":
        return n(yoy.kiosk) > 0 ? int(n(yoy.kiosk)) : "—";
      case "Till (takeaway)":
        return n(yoy.till_takeaway) > 0 ? int(n(yoy.till_takeaway)) : "—";
      case "Till (eat-in)":
        return n(yoy.till_eat_in) > 0 ? int(n(yoy.till_eat_in)) : "—";

      default:
        return "—";
    }
  };

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
      render: (r: KpiRowDef) => <span className={toneClass(r.tone)}>{r.cell(byStore.get(s)!)}</span>,
    })),
    // Total column only adds information when more than one store is shown.
    ...(activeStores.length > 1
      ? [
          {
            key: "total",
            header: "Total",
            align: "right" as const,
            render: (r: KpiRowDef) => (
              <span className={`font-semibold ${toneClass(r.tone)}`}>{r.cell(combined)}</span>
            ),
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
    {
      key: "yoy",
      header: `YoY (${yoyWeek})`,
      align: "right" as const,
      render: (r: KpiRowDef) => {
        const yoyPct = yoyPctMap[r.kpi] ?? null;
        return (
          <span className="text-text-muted text-sm">
            {getYoyCellValue(r.kpi, yoyRow)}
            {yoyPct !== null && (
              <span className={`ml-1.5 font-medium ${deltaClass(yoyPct)}`}>
                ({signedPct(yoyPct)})
              </span>
            )}
          </span>
        );
      },
    },
  ];

  // ---- Order-mix tables (per channel, within each group) -----------------
  // Revenue-based share (not order-based) for consistency with other dashboards,
  // plus a Net Sales column and a TOTAL row so the % is easy to verify.
  interface ChannelRow extends ChannelStat {
    isTotal?: boolean;
  }
  const buildChannelTable = (group: GroupAgg): ChannelRow[] => [
    ...group.channels,
    {
      channel: "TOTAL",
      netSales: group.netSales,
      orders: group.orders,
      aov: group.aov,
      orderPct: 100,
      salesPct: 100,
      isTotal: true,
    },
  ];

  const mixColumns: Column<ChannelRow>[] = [
    {
      key: "ch",
      header: "Channel",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold" : "font-medium"}>{r.channel}</span>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{int(r.orders)}</span>,
    },
    {
      key: "net-sales",
      header: "Net Sales",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{gbp(r.netSales)}</span>,
    },
    {
      key: "pct",
      header: "% of group (revenue)",
      align: "right",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold" : ""}>{pct(r.salesPct)}</span>
      ),
    },
    {
      key: "aov",
      header: "AOV",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{gbp(r.aov)}</span>,
    },
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
    store: activeStore,
    totalWow: netWow,
    combined: {
      netSales: combined.netSales,
      deliveryNetSales: combined.delivery.netSales,
      inStoreNetSales: combined.inStore.netSales,
      orders: combined.orders,
      aov: combined.aov,
      deliveryAov: combined.delivery.aov,
      inStoreAov: combined.inStore.aov,
      deliveryPct: share(combined.delivery.netSales, combined.netSales),
      inStorePct: share(combined.inStore.netSales, combined.netSales),
      customers: combined.customers,
    },
    stores: activeStores.map((s) => {
      const b = byStore.get(s)!;
      const row = rows.find((r) => r.store === s);
      return {
        store: s,
        netSales: b.netSales,
        deliveryNetSales: b.delivery.netSales,
        inStoreNetSales: b.inStore.netSales,
        orders: b.orders,
        aov: b.aov,
        deliveryAov: b.delivery.aov,
        inStoreAov: b.inStore.aov,
        customers: b.customers,
        deliveryPct: share(b.delivery.netSales, b.netSales),
        inStorePct: share(b.inStore.netSales, b.netSales),
        collectionPct: row ? n(row.collection_pct) : 0,
        eatInPct: row ? n(row.eat_in_pct) : 0,
        netSalesWow: (() => {
          const prevB = prevByStore.get(s);
          if (!hasPrev || !prevB || prevB.netSales <= 0) return null;
          return share(b.netSales - prevB.netSales, prevB.netSales);
        })(),
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
        <KpiCard label="Net Sales" value={gbp(combined.netSales)} delta={netWow} yoy={netYoy} />
        <KpiCard label="Net Sales — Delivery" value={gbp(combined.delivery.netSales)} delta={netDelWow} yoy={delYoy} />
        <KpiCard label="Net Sales — Own Delivery" value={gbp(ownDel.netSales)} delta={netOwnWow} yoy={ownDelYoy} tone="good" />
        <KpiCard label="Net Sales — Aggregator" value={gbp(aggDel.netSales)} delta={netAggWow} yoy={aggYoy} hint="Deliveroo + Uber + Just Eat" tone="bad" />
        <KpiCard label="Net Sales — In-store" value={gbp(combined.inStore.netSales)} delta={netInWow} yoy={inStYoy} tone="good" />
        <KpiCard label="Total Orders" value={int(combined.orders)} delta={ordWow} yoy={ordYoy} />
        <KpiCard
          label="AOV (Blended)"
          value={gbp(combined.aov)}
          delta={aovBlendWow}
          hint="net sales ÷ orders"
        />
        <KpiCard label="AOV — Delivery" value={gbp(combined.delivery.aov)} delta={aovDelWow} />
        <KpiCard label="AOV — Own Delivery" value={gbp(ownDel.aov)} delta={aovOwnWow} tone="good" />
        <KpiCard label="AOV — Aggregator" value={gbp(aggDel.aov)} delta={aovAggWow} hint="Deliveroo + Uber + Just Eat" tone="bad" />
        <KpiCard label="AOV — In-store" value={gbp(combined.inStore.aov)} delta={aovInWow} tone="good" />
        <KpiCard label="Customers" value={int(combined.customers)} delta={custWow} yoy={custYoy} />
        <KpiCard label="Own Delivery %" value={pct(share(ownDel.netSales, combined.netSales))} hint="of net sales" tone="good" />
        <KpiCard label="Aggregate %" value={pct(share(aggDel.netSales, combined.netSales))} hint="of net sales" tone="bad" />
        <KpiCard label="Delivery %" value={pct(share(combined.delivery.netSales, combined.netSales))} hint="of net sales" />
        <KpiCard label="In-store %" value={pct(share(combined.inStore.netSales, combined.netSales))} hint="of net sales" tone="good" />
        <KpiCard
          label="Net Sales WoW"
          value={signedPct(netWow)}
          hint={hasPrev ? "vs previous week" : "no prior week"}
        />
        <KpiCard
          label="Net Sales YoY"
          value={signedPct(netYoy)}
          hint={hasYoy ? `vs ${yoyWeek}` : "no YoY data"}
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
            <DataTable columns={mixColumns} rows={buildChannelTable(combined.delivery)} />
            {deliveryOrdersChart.length > 0 && (
              <div className="mt-6">
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
            <DataTable columns={mixColumns} rows={buildChannelTable(combined.inStore)} />
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
