import {
  getExec,
  getProducts,
  getMenuCategories,
  getDayparts,
  getDelivery,
  getLaborCost,
  getAttachmentRates,
  getMealDeals,
  resolveWeek,
  getWeeks,
} from "@/lib/vm-analytics/queries";
import { gbp, gbp0, int, pct, weekRange, n } from "@/lib/vm-analytics/format";
import { shortStore } from "@/lib/vm-analytics/constants";
import {
  buildExceptionReport,
  type KpiTableRow,
  type DeliveryDependenceRow,
} from "@/lib/vm-analytics/exceptions";
import { Section } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { AttachmentRow } from "@/lib/vm-analytics/types";

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
    header: "Revenue",
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
  { key: "aov", header: "AOV", align: "right", render: (r) => gbp(r.aov) },
  {
    key: "labour",
    header: "Labour % of Net",
    align: "right",
    render: (r) =>
      r.labourPctOfNet == null ? (
        <span className="text-tertiary">—</span>
      ) : (
        <span>{pct(r.labourPctOfNet)}</span>
      ),
  },
  { key: "delivery", header: "Delivery %", align: "right", render: (r) => pct(r.deliveryPct) },
  {
    key: "top3",
    header: "Top 3 Products",
    render: (r) => (
      <div className="space-y-0.5">
        {r.top3.map((p, i) => (
          <div key={i} className="text-xs text-secondary">
            {i + 1}. {p.name} <span className="text-tertiary">({gbp0(p.revenue)})</span>
          </div>
        ))}
      </div>
    ),
  },
];

const attachColumns: Column<AttachmentRow>[] = [
  { key: "item", header: "Item", render: (r) => r.item_name },
  { key: "store", header: "Store", render: (r) => shortStore(r.store) },
  { key: "attach", header: "Attach %", align: "right", render: (r) => pct(r.attach_pct) },
  {
    key: "prev",
    header: "Prev Week",
    align: "right",
    render: (r) => (r.prev_attach_pct == null ? "—" : pct(r.prev_attach_pct)),
  },
  {
    key: "delta",
    header: "Change",
    align: "right",
    render: (r) =>
      r.attach_pct_delta == null ? (
        "—"
      ) : (
        <span
          className={
            n(r.attach_pct_delta) < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        >
          {n(r.attach_pct_delta) >= 0 ? "+" : ""}
          {n(r.attach_pct_delta).toFixed(1)} pp
        </span>
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
    key: "thirdParty",
    header: "3rd-Party Total",
    align: "right",
    render: (r) => (
      <span
        className={
          r.overThreshold
            ? "font-semibold text-rose-600 dark:text-rose-400"
            : "font-semibold text-primary"
        }
      >
        {pct(r.thirdPartyPct)}
      </span>
    ),
  },
  {
    key: "own",
    header: "Own Delivery",
    align: "right",
    render: (r) => <span className="text-secondary">{pct(r.ownDeliveryPct)}</span>,
  },
  {
    key: "all",
    header: "All Delivery",
    align: "right",
    render: (r) => <span className="text-secondary">{pct(r.allDeliveryPct)}</span>,
  },
];

function ExceptionList({
  items,
}: {
  items: { text: string; detail?: string }[];
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((o, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium text-primary">{o.text}</span>
          {o.detail && <span className="block text-xs text-secondary">{o.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export default async function WeeklyExceptionPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  let weekIso: string | null;
  let weekEnd = "";
  let report: ReturnType<typeof buildExceptionReport>;
  let attachment: AttachmentRow[] = [];

  try {
    weekIso = await resolveWeek(searchParams.week);
    if (!weekIso) return <EmptyWeek />;

    const [exec, products, categories, dayparts, delivery, labour, attach, mealDeals, weeks] =
      await Promise.all([
        getExec(weekIso),
        getProducts(weekIso),
        getMenuCategories(weekIso),
        getDayparts(weekIso),
        getDelivery(weekIso),
        getLaborCost(weekIso).catch(() => []), // cashflow may lag; degrade gracefully
        getAttachmentRates(weekIso),
        getMealDeals(weekIso),
        getWeeks(),
      ]);

    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    attachment = attach;

    if (exec.length === 0) {
      return (
        <>
          <PageTitle title="Weekly Exception Report" />
          <EmptyWeek />
        </>
      );
    }

    report = buildExceptionReport({
      exec,
      products,
      categories,
      dayparts,
      delivery,
      labour,
      attachment: attach,
      mealDeals,
    });
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  const { kpi, opportunities, risks, deliveryDependence, platformThreshold, labourDataPartial } =
    report;

  // Supporting table: most-attached items (in ≥10% of orders) that have a prior
  // week to compare, top 12 by current attachment.
  const attachTop = attachment
    .filter((a) => n(a.attach_pct) >= 10 && a.prev_attach_pct != null)
    .sort((a, b) => n(b.attach_pct) - n(a.attach_pct))
    .slice(0, 12);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Weekly Exception Report"
        subtitle={`Opportunities & risks across all reports · ${weekRange(weekIso, weekEnd)}`}
      />

      <Section
        title="KPI Summary"
        description="Headline metrics per store. Labour % is scheduled rota wages ÷ net sales."
      >
        <DataTable columns={kpiColumns} rows={kpi} />
        {labourDataPartial && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
            ⚠ Labour % looks low (under 15% of net) — the rota data for this week may be incomplete,
            so labour-based figures should be treated as indicative.
          </p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="vm-card p-5 border-l-4 border-l-emerald-500">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="text-emerald-600 dark:text-emerald-400">▲</span> Opportunities
          </h3>
          {opportunities.length === 0 ? (
            <p className="text-sm text-tertiary">No standout opportunities this week.</p>
          ) : (
            <ExceptionList items={opportunities} />
          )}
        </div>

        <div className="vm-card p-5 border-l-4 border-l-rose-500">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="text-rose-600 dark:text-rose-400">▼</span> Risks
          </h3>
          {risks.length === 0 ? (
            <p className="text-sm text-tertiary">No risks crossed threshold this week.</p>
          ) : (
            <ExceptionList items={risks} />
          )}
        </div>
      </div>

      {deliveryDependence.length > 0 && (
        <Section
          title="Delivery Platform Dependence"
          description={`Share of each store's sales by delivery channel. "3rd-Party Total" (Just Eat + Uber Eats + Deliveroo) is the platform-dependence figure — it turns red above ${platformThreshold}%. Own Delivery (your own drivers) is shown separately and is not counted as platform dependence.`}
        >
          <DataTable columns={deliveryColumns} rows={deliveryDependence} />
        </Section>
      )}

      {attachTop.length > 0 && (
        <Section
          title="Attachment Rates"
          description="Share of orders containing each item vs the previous week. Powers the falling-attachment risks above."
        >
          <DataTable columns={attachColumns} rows={attachTop} />
        </Section>
      )}
    </div>
  );
}
