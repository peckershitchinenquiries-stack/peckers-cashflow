import {
  getExec,
  getExecChannels,
  getProducts,
  getDayparts,
  getDelivery,
  getLaborCost,
  getMealDeals,
  resolveWeek,
  getWeeks,
} from "@/lib/vm-analytics/queries";
import { gbp, int, pct, weekRange } from "@/lib/vm-analytics/format";
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
  {
    key: "top3",
    header: "Top 3 Products",
    render: (r) => (
      <div className="space-y-0.5">
        {r.top3.map((p, i) => (
          <div key={i} className="text-xs text-secondary">
            {i + 1}. {p.name}{" "}
            <span className="text-tertiary">
              ({gbp(p.revenue)} · {int(p.units)} units)
            </span>
          </div>
        ))}
      </div>
    ),
  },
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
    weekIso = await resolveWeek(searchParams.week);
    if (!weekIso) return <EmptyWeek />;

    const [exec, channels, products, dayparts, delivery, labour, mealDeals, weeks] =
      await Promise.all([
        getExec(weekIso),
        getExecChannels(weekIso),
        getProducts(weekIso),
        getDayparts(weekIso),
        getDelivery(weekIso),
        getLaborCost(weekIso).catch(() => []), // cashflow may lag; degrade gracefully
        getMealDeals(weekIso),
        getWeeks(),
      ]);

    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";

    if (exec.length === 0) {
      return (
        <>
          <PageTitle title="Weekly Exception Report" />
          <EmptyWeek />
        </>
      );
    }

    // Scope every dataset to the selected store so the whole report (KPIs,
    // opportunities, risks) is store-specific. Labour uses a different store
    // naming convention, so match on the canonical key.
    const scope = activeStore;
    const byStore = <Row extends { store: string }>(rows: Row[]) =>
      scope ? rows.filter((r) => r.store === scope) : rows;
    const byCanonical = <Row extends { store: string }>(rows: Row[]) =>
      scope ? rows.filter((r) => canonicalStore(r.store) === canonicalStore(scope)) : rows;

    report = buildExceptionReport({
      exec: byStore(exec),
      channels: byStore(channels),
      products: byStore(products),
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

  return (
    <div className="space-y-7">
      <PageTitle
        title="Weekly Exception Report"
        subtitle={`Opportunities & risks · ${scopeLabel} · ${weekRange(weekIso, weekEnd)}`}
      />

      <Section
        title="KPI Summary"
        description="Headline metrics per store. AOV is split into delivery and in-store. Labour % is scheduled rota wages ÷ net sales."
      >
        <DataTable columns={kpiColumns} rows={kpi} />
        {labourDataPartial && (
          <p className="mt-2 text-xs text-warning">
            ⚠ Labour % looks low (under 15% of net) — the rota data for this week may be incomplete,
            so labour-based figures should be treated as indicative.
          </p>
        )}
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
