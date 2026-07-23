import {
  getExec,
  getExecChannels,
  getProductsNet,
  getDayparts,
  getDelivery,
  getLaborCost,
  getMealDeals,
  getWeeks,
} from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, weekRange } from "@/lib/vm-analytics/format";
import { canonicalStore, resolveStore, shortStore } from "@/lib/vm-analytics/constants";
import {
  buildExceptionReport,
  type KpiTableRow,
  type DeliveryDependenceRow,
} from "@/lib/vm-analytics/exceptions";
import { Section } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";

export const dynamic = "force-dynamic";

type RankedItem = { name: string; revenue: number; units: number };

// One row per rank position per store, so the top and least sellers read down
// the page instead of being stacked inside a single KPI Summary cell.
interface ItemRankRow {
  store: string;
  showStore: boolean; // store name printed once per group
  top: RankedItem | null;
  bottom: RankedItem | null;
}

function buildItemRanks(kpi: KpiTableRow[]): ItemRankRow[] {
  const rows: ItemRankRow[] = [];
  for (const k of kpi) {
    const depth = Math.max(k.top3.length, k.bottom3.length);
    for (let i = 0; i < depth; i++) {
      rows.push({
        store: k.store,
        showStore: i === 0,
        top: k.top3[i] ?? null,
        bottom: k.bottom3[i] ?? null,
      });
    }
  }
  return rows;
}

function ItemCell({ item }: { item: RankedItem | null }) {
  if (!item) return <span className="text-tertiary">—</span>;
  return (
    <span>
      {item.name}{" "}
      <span className="text-xs text-tertiary">
        ({gbp(item.revenue)} · {int(item.units)} units)
      </span>
    </span>
  );
}

const itemRankColumns: Column<ItemRankRow>[] = [
  {
    key: "store",
    header: "Store",
    render: (r) =>
      r.showStore ? (
        <span className={r.store === "TOTAL" ? "font-semibold" : "font-medium"}>{r.store}</span>
      ) : null,
  },
  { key: "top", header: "Most Selling Item", render: (r) => <ItemCell item={r.top} /> },
  { key: "bottom", header: "Least Selling Item", render: (r) => <ItemCell item={r.bottom} /> },
];

const kpiColumns: Column<KpiTableRow>[] = [
  {
    key: "store",
    header: "KPI / Store",
    render: (r) => (
      <span className={r.store === "TOTAL" ? "font-semibold" : "font-medium"}>{r.store}</span>
    ),
  },
  {
    key: "revenue",
    header: "Net Sales",
    align: "right",
    render: (r) => (
      <span className={r.store === "TOTAL" ? "font-semibold" : ""}>{gbp(r.revenue)}</span>
    ),
  },
  {
    key: "orders",
    header: "Orders",
    align: "right",
    render: (r) => (
      <span className={r.store === "TOTAL" ? "font-semibold" : ""}>{int(r.orders)}</span>
    ),
  },
  { key: "aovDel", header: "AOV — Delivery", align: "right", render: (r) => gbp(r.deliveryAov) },
  { key: "aovIn", header: "AOV — In-store", align: "right", render: (r) => gbp(r.inStoreAov) },
  // {
  //   key: "labour",
  //   header: "Labour % of Net",
  //   align: "right",
  //   render: (r) =>
  //     r.labourPctOfNet == null ? (
  //       <span className="text-tertiary">—</span>
  //     ) : (
  //       <span>{pct(r.labourPctOfNet)}</span>
  //     ),
  // },
  { key: "delivery", header: "Delivery %", align: "right", render: (r) => pct(r.deliveryPct) },
  { key: "inStore", header: "In-store %", align: "right", render: (r) => pct(r.inStorePct) },
];

const deliveryColumns: Column<DeliveryDependenceRow>[] = [
  {
    key: "store",
    header: "Store",
    render: (r) => (
      <span className={r.store === "TOTAL" ? "font-semibold" : "font-medium"}>{r.store}</span>
    ),
  },
  { key: "justEat", header: "Just Eat", align: "right", render: (r) => pct(r.justEatPct) },
  { key: "uber", header: "Uber Eats", align: "right", render: (r) => pct(r.uberPct) },
  { key: "deliveroo", header: "Deliveroo", align: "right", render: (r) => pct(r.deliverooPct) },
  {
    key: "aggregator",
    header: "Aggregator Total",
    align: "right",
    render: (r) => (
      <span
        className={
          r.overThreshold
            ? "font-bold text-danger"
            : "font-bold text-warning"
        }
      >
        {pct(r.aggregatorPct)}
      </span>
    ),
  },
  {
    key: "own",
    header: "Own Delivery",
    align: "right",
    render: (r) => (
      <span className="font-bold text-success">
        {pct(r.ownDeliveryPct)}
      </span>
    ),
  },
  {
    key: "all",
    header: "All Delivery",
    align: "right",
    render: (r) => <span className="text-secondary">{pct(r.allDeliveryPct)}</span>,
  },
];

function ExceptionList({ items }: { items: { text: string; detail?: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((o, i) => (
        <li key={i} className="text-sm leading-relaxed text-primary">
          {o.text}
          {o.detail && <span className="block text-xs text-secondary">{o.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export default async function WeeklyExceptionPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores combined";

  let weekIso: string | null;
  let weekEnd = "";
  let report: ReturnType<typeof buildExceptionReport>;

  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
    const prevWeekIso = idx >= 0 ? weeks[idx + 1]?.week_start_iso ?? null : null;

    const [exec, channels, products, dayparts, delivery, labour, mealDeals, prevExec, prevProducts] =
      await Promise.all([
        getExec(weekIso),
        getExecChannels(weekIso),
        // NET item-level sales (vm_v_product_net), matching the Product
        // Performance dashboard. The view also drops the 'delivery fee' and
        // 'service charge' pseudo-rows the gross feed carries.
        getProductsNet(weekIso),
        getDayparts(weekIso),
        getDelivery(weekIso),
        getLaborCost(weekIso).catch(() => []), // cashflow may lag; degrade gracefully
        getMealDeals(weekIso).catch(() => []), // vm_v_meal_deals can time out on cold cache; degrade gracefully

        prevWeekIso ? getExec(prevWeekIso) : Promise.resolve([]),
        prevWeekIso ? getProductsNet(prevWeekIso) : Promise.resolve([]),
      ]);

    if (exec.length === 0) {
      return (
        <>
          <PageTitle title="Weekly Exception Report" />
          <EmptyWeek />
        </>
      );
    }

    // Build prev-week lookup maps for WoW computation.
    const prevExecMap = new Map(prevExec.map((e) => [e.store, e]));
    const prevProductMap = new Map<string, { revenue: number; units: number }>();
    for (const r of prevProducts) {
      const key = `${r.store}::${r.item_name}`;
      const cur = prevProductMap.get(key) ?? { revenue: 0, units: 0 };
      cur.revenue += n(r.gross_sales);
      cur.units += n(r.units_sold);
      prevProductMap.set(key, cur);
    }

    // Override pre-rounded DB WoW fields with exact values computed from raw data.
    const augmentedExec = exec.map((e) => {
      const prev = prevExecMap.get(e.store);
      const prevSales = prev ? n(prev.net_sales) : 0;
      if (prevSales <= 0) return e;
      return { ...e, net_sales_wow_pct: (n(e.net_sales) - prevSales) / prevSales * 100 };
    });

    const augmentedProducts = products.map((p) => {
      const key = `${p.store}::${p.item_name}`;
      const prev = prevProductMap.get(key);
      if (!prev || prev.revenue <= 0) return p;
      return {
        ...p,
        revenue_wow_pct: (n(p.gross_sales) - prev.revenue) / prev.revenue * 100,
        units_wow_pct: prev.units > 0 ? (n(p.units_sold) - prev.units) / prev.units * 100 : p.units_wow_pct,
      };
    });

    // Scope every dataset to the selected store so the whole report (KPIs,
    // opportunities, risks) is store-specific. Labour uses a different store
    // naming convention, so match on the canonical key.
    const scope = activeStore;
    const byStore = <Row extends { store: string }>(rows: Row[]) =>
      scope ? rows.filter((r) => r.store === scope) : rows;
    const byCanonical = <Row extends { store: string }>(rows: Row[]) =>
      scope ? rows.filter((r) => canonicalStore(r.store) === canonicalStore(scope)) : rows;

    report = buildExceptionReport({
      exec: byStore(augmentedExec),
      channels: byStore(channels),
      products: byStore(augmentedProducts),
      dayparts: byStore(dayparts),
      delivery: byStore(delivery),
      labour: byCanonical(labour),
      mealDeals: byCanonical(mealDeals),
      activeStore,
    });
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  const { kpi, opportunities, risks, deliveryDependence, labourDataPartial } = report;
  const itemRanks = buildItemRanks(kpi);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Weekly Exception Report"
        subtitle={`Opportunities & risks · ${scopeLabel} · ${weekRange(weekIso, weekEnd)}`}
      />

      <Section
        title="KPI Summary"
        description="Headline metrics per store. AOV is split into delivery and in-store. Delivery % and In-store % are each channel's share of net sales."
      >
        <DataTable columns={kpiColumns} rows={kpi} />
        {labourDataPartial && (
          <p className="mt-2 text-xs text-warning">
            ⚠ Labour % looks low (under 15% of net) — the rota data for this week may be incomplete,
            so labour-based figures should be treated as indicative.
          </p>
        )}
      </Section>

      <Section
        title="Most and Least Selling Items"
        description="The three best and three weakest sellers per store, ranked on NET item sales (same source as the Product Performance dashboard). The least-selling ranking excludes items that recorded no sale, loyalty and comped items (£0.00 revenue), hidden items, and drinks and sides — so it reflects the core menu rather than add-ons."
      >
        <DataTable
          columns={itemRankColumns}
          rows={itemRanks}
          emptyMessage="No ranked item sales for this week."
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="vm-card p-5 border-l-4 border-l-success">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="text-success">▲</span> Opportunities
          </h3>
          {opportunities.length === 0 ? (
            <p className="text-sm text-tertiary">No standout opportunities this week.</p>
          ) : (
            <ExceptionList items={opportunities} />
          )}
        </div>

        <div className="vm-card p-5 border-l-4 border-l-danger">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="text-danger">▼</span> Risks
          </h3>
          {risks.length === 0 ? (
            <p className="text-sm text-tertiary">Nothing needs attention this week.</p>
          ) : (
            <ExceptionList items={risks} />
          )}
        </div>
      </div>

      {deliveryDependence.length > 0 && (
        <Section
          title="Delivery Platform Dependence"
          description={`Share of each store's sales by delivery channel. "Aggregator Total" (Just Eat + Uber Eats + Deliveroo) is the commission-charging share — it turns red when it gets high. Own Delivery (your own drivers) is highlighted in green: growing it wins back commission.`}
        >
          <DataTable columns={deliveryColumns} rows={deliveryDependence} />
        </Section>
      )}
    </div>
  );
}
