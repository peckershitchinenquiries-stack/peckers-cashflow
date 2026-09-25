import { redirect } from "next/navigation";
import {
  getLabourByStoreWeek,
  getLabourTargets,
  getLabourWeeks,
  labourBridge,
  type LabourBridge,
  type LabourWeekRow,
} from "@/lib/vm-analytics/labour";
import { gbp, int, pct, weekRange } from "@/lib/vm-analytics/format";
import {
  EXCEPTION_THRESHOLDS,
  resolveStore,
  shortStore,
} from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { ComboChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";

export const dynamic = "force-dynamic";

const TREND_WEEKS = 13;

const hrs = (v: number) => `${v.toFixed(1)}h`;
const pp = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}pp`;

/** The three causes as one plain sentence, biggest first. */
function bridgeSentence(b: LabourBridge): string | null {
  if (Math.abs(b.total_pp) < 0.05) return null;
  const parts = [
    { pp: b.sales_pp, up: "sales fell", down: "sales grew" },
    { pp: b.hours_pp, up: "more hours worked", down: "fewer hours worked" },
    { pp: b.rate_pp, up: "a dearer hour", down: "a cheaper hour" },
  ]
    .filter((p) => Math.abs(p.pp) >= 0.05)
    .sort((a, b2) => Math.abs(b2.pp) - Math.abs(a.pp))
    .map((p) => `${Math.abs(p.pp).toFixed(1)}pp ${p.pp > 0 ? p.up : p.down}`);
  if (parts.length === 0) return null;
  const dir = b.total_pp > 0 ? "rose" : "fell";
  return `Labour % ${dir} ${Math.abs(b.total_pp).toFixed(1)}pp on last week — ${parts.join(", ")}.`;
}

function wow(now: number, before: number): number | null {
  if (!(before > 0)) return null;
  return ((now - before) / before) * 100;
}

/** Sum the components of several store rows into one scope-level figure. */
function combine(rows: LabourWeekRow[]) {
  const add = (k: keyof LabourWeekRow) =>
    rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const netRows = rows.filter((r) => r.net_sales != null);
  const net = netRows.length > 0 ? netRows.reduce((t, r) => t + (r.net_sales ?? 0), 0) : null;
  const total_cost = add("total_cost");
  const total_hours = add("total_hours");
  const manager_cost = add("manager_cost");
  return {
    ni_cost: add("ni_cost"),
    ni_hours: add("ni_hours"),
    cash_cost: add("cash_cost"),
    cash_hours: add("cash_hours"),
    delivery_cost: add("delivery_cost"),
    deliveries: add("deliveries"),
    manager_cost,
    manager_days: add("manager_days"),
    manager_hours: add("manager_hours"),
    cover_driver_cost: add("cover_driver_cost"),
    cover_driver_hours: add("cover_driver_hours"),
    total_cost,
    total_hours,
    unapproved_days: add("unapproved_days"),
    net_sales: net,
    labour_pct: net != null && net > 0 ? (total_cost / net) * 100 : null,
    splh: net != null && total_hours > 0 ? net / total_hours : null,
    // A manager's fixed daily wage doesn't flex with trade, so a quiet week
    // lifts labour % with the rota unchanged. Splitting it says which happened.
    fixed_cost: manager_cost,
    variable_cost: total_cost - manager_cost,
  };
}

type StoreCompareRow = {
  store: string;
  labour_pct: number | null;
  gap: number | null;
  over: number | null;
  splh: number | null;
  plan_variance: number | null;
  cost_per_drop: number | null;
};

type CompositionRow = {
  store: string;
  showStore: boolean;
  label: string;
  cost: number;
  /** £ movement on the same line last week. Null when there is no prior week. */
  delta: number | null;
  units: string;
  share: number | null;
  shareOfSales: number | null;
  isTotal: boolean;
};

export default async function LaborCostPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  let weeks;
  try {
    weeks = await getLabourWeeks();
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (weeks.length === 0) {
    return (
      <>
        <PageTitle title="Labour Cost Performance" />
        <EmptyWeek message="No clocked work found in the last year. Labour cost is built from approved clock records, so there is nothing to cost yet." />
      </>
    );
  }

  // weeks is newest-first and already excludes the in-progress week, so [0] is
  // the most recent completed week.
  if (!searchParams.week) {
    const params = new URLSearchParams();
    params.set("week", weeks[0].week_start_iso);
    if (searchParams.store) params.set("store", searchParams.store);
    redirect(`/vm-analytics/labor-cost?${params.toString()}`);
  }

  const idx = Math.max(
    0,
    weeks.findIndex((w) => w.week_start_iso === searchParams.week),
  );
  const match = weeks[idx];
  const weekIso = match.week_start_iso;
  const prevWeekIso = weeks[idx + 1]?.week_start_iso ?? null;
  const trendWeeks = weeks.slice(idx, idx + TREND_WEEKS).map((w) => w.week_start_iso);

  const activeStore = resolveStore(searchParams.store);
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores";

  // One aggregator call serves the selected week, the WoW comparison and the
  // whole 13-week trend.
  const [labour, targets] = await Promise.all([
    getLabourByStoreWeek(trendWeeks),
    getLabourTargets([weekIso]),
  ]);

  const inScope = (r: { vm_store_name: string | null }) =>
    !activeStore || r.vm_store_name === activeStore;

  const weekRows = labour.rows.filter((r) => r.week_start === weekIso && inScope(r));
  const prevRows = prevWeekIso
    ? labour.rows.filter((r) => r.week_start === prevWeekIso && inScope(r))
    : [];

  if (weekRows.length === 0) {
    return (
      <>
        <PageTitle
          title="Labour Cost Performance"
          subtitle={`${scopeLabel} · ${weekRange(weekIso, match.week_end)}`}
        />
        {labour.load_error && <ErrorState message={labour.load_error} />}
        <EmptyWeek message="No stores matched this view." />
      </>
    );
  }

  const cur = combine(weekRows);
  const prev = prevRows.length > 0 ? combine(prevRows) : null;

  const defaultTarget = EXCEPTION_THRESHOLDS.labourTargetPct;
  const targetFor = (r: LabourWeekRow) =>
    targets.get(`${r.store_id}|${weekIso}`) ?? defaultTarget;
  // Scope-level target: the mean of the stores in view, which for a single
  // store is simply that store's own budget.
  const scopeTarget =
    weekRows.reduce((t, r) => t + targetFor(r), 0) / weekRows.length;

  const cashSheetStores = weekRows.filter((r) => r.revenue_source === "cash_sheet");
  const noRevenueStores = weekRows.filter((r) => r.net_sales == null);

  // ---- Band 1 -------------------------------------------------------------
  const labourGap = cur.labour_pct != null ? cur.labour_pct - scopeTarget : null;
  const costWow = prev ? wow(cur.total_cost, prev.total_cost) : null;
  const salesWow =
    prev && prev.net_sales != null && cur.net_sales != null
      ? wow(cur.net_sales, prev.net_sales)
      : null;
  const splhWow =
    prev && prev.splh != null && cur.splh != null ? wow(cur.splh, prev.splh) : null;

  // The percentage says how far off target; the money says how much it cost.
  const budgetAllowance = cur.net_sales != null ? cur.net_sales * (scopeTarget / 100) : null;
  const overspend = budgetAllowance != null ? cur.total_cost - budgetAllowance : null;

  const bridge = prev ? labourBridge(prev, cur) : null;
  const bridgeText = bridge ? bridgeSentence(bridge) : null;

  // ---- Band 1b ------------------------------------------------------------
  // Only worth a table when there is something to compare against.
  const compareRows: StoreCompareRow[] =
    weekRows.length < 2
      ? []
      : weekRows.map((r) => {
          const target = targetFor(r);
          const employeeHours = r.ni_hours + r.cash_hours;
          return {
            store: shortStore(r.store),
            labour_pct: r.labour_pct,
            gap: r.labour_pct == null ? null : r.labour_pct - target,
            over:
              r.net_sales == null ? null : r.total_cost - r.net_sales * (target / 100),
            splh:
              r.net_sales != null && r.total_hours > 0 ? r.net_sales / r.total_hours : null,
            plan_variance: r.rota_hours > 0 ? employeeHours - r.rota_hours : null,
            cost_per_drop: r.deliveries > 0 ? r.delivery_cost / r.deliveries : null,
          };
        });

  const compareColumns: Column<StoreCompareRow>[] = [
    { key: "store", header: "Store", render: (r) => <span className="font-medium">{r.store}</span> },
    {
      key: "labour_pct",
      header: "Labour %",
      align: "right",
      render: (r) => (r.labour_pct == null ? "—" : pct(r.labour_pct, 1)),
    },
    {
      key: "gap",
      header: "Vs target",
      align: "right",
      render: (r) =>
        r.gap == null ? (
          "—"
        ) : (
          <span className={r.gap > 0 ? "text-danger" : "text-success"}>{pp(r.gap)}</span>
        ),
    },
    {
      key: "over",
      header: "Over budget",
      align: "right",
      render: (r) =>
        r.over == null ? (
          "—"
        ) : (
          <span className={r.over > 0 ? "text-danger" : "text-success"}>
            {r.over > 0 ? "+" : "−"}
            {gbp(Math.abs(r.over))}
          </span>
        ),
    },
    {
      key: "splh",
      header: "Sales / hour",
      align: "right",
      render: (r) => (r.splh == null ? "—" : `${gbp(r.splh)}/h`),
    },
    {
      key: "plan_variance",
      header: "Hours vs plan",
      align: "right",
      render: (r) =>
        r.plan_variance == null ? (
          "—"
        ) : (
          <span className={r.plan_variance > 0 ? "text-danger" : "text-secondary"}>
            {r.plan_variance > 0 ? "+" : "−"}
            {hrs(Math.abs(r.plan_variance))}
          </span>
        ),
    },
    {
      key: "cost_per_drop",
      header: "Cost / drop",
      align: "right",
      render: (r) => (r.cost_per_drop == null ? "—" : gbp(r.cost_per_drop)),
    },
  ];

  // ---- Band 2 -------------------------------------------------------------
  const trendStores = Array.from(
    new Map(weekRows.map((r) => [r.store_id, r])).values(),
  );
  const weeksAsc = [...trendWeeks].reverse();

  // The scope's own labour % per week — cost and sales summed across the stores
  // in view, never the mean of their percentages, which would weight a quiet
  // store equally with a busy one.
  const scopePctAsc = weeksAsc.map((w) => {
    const rows = labour.rows.filter(
      (r) => r.week_start === w && trendStores.some((t) => t.store_id === r.store_id),
    );
    const cost = rows.reduce((t, r) => t + r.total_cost, 0);
    const net = rows.reduce((t, r) => t + (r.net_sales ?? 0), 0);
    return net > 0 ? (cost / net) * 100 : null;
  });

  // Trailing 4 weeks, and only where all four exist — a "4-week average" drawn
  // from two weeks is a different statistic wearing the same label.
  const rollingAsc = scopePctAsc.map((_, i) => {
    if (i < 3) return null;
    const win = scopePctAsc.slice(i - 3, i + 1);
    return win.every((v) => v != null)
      ? (win as number[]).reduce((a, b) => a + b, 0) / 4
      : null;
  });

  const ratedWeeks = scopePctAsc.filter((v): v is number => v != null);
  const weeksInTarget = ratedWeeks.filter((v) => v <= scopeTarget).length;

  const trendData = weeksAsc.map((w, i) => {
    const point: Record<string, unknown> = {
      week: weekRange(w),
    };
    let net = 0;
    for (const s of trendStores) {
      const row = labour.rows.find((r) => r.week_start === w && r.store_id === s.store_id);
      point[`${shortStore(s.store)} labour %`] = row?.labour_pct ?? null;
      net += row?.net_sales ?? 0;
    }
    point["4-week average"] = rollingAsc[i] == null ? null : Number(rollingAsc[i]!.toFixed(2));
    point["Net sales"] = Math.round(net);
    return point;
  });

  // ---- Band 3 -------------------------------------------------------------
  const compositionRows: CompositionRow[] = [];
  for (const r of weekRows) {
    const before = prevRows.find((p) => p.store_id === r.store_id) ?? null;
    const parts: Array<[string, keyof LabourWeekRow, string]> = [
      ["NI / bank hours (PAYE)", "ni_cost", hrs(r.ni_hours)],
      ["Cash hours", "cash_cost", hrs(r.cash_hours)],
      ["Delivery pay", "delivery_cost", `${int(r.deliveries)} drops`],
      ["Manager fixed wage", "manager_cost", `${int(r.manager_days)} days`],
      ["Cover drivers", "cover_driver_cost", hrs(r.cover_driver_hours)],
    ];
    parts.forEach(([label, key, units], i) => {
      const cost = Number(r[key]) || 0;
      compositionRows.push({
        store: shortStore(r.store),
        showStore: i === 0,
        label,
        cost,
        delta: before ? cost - (Number(before[key]) || 0) : null,
        units,
        share: r.total_cost > 0 ? (cost / r.total_cost) * 100 : null,
        shareOfSales: r.net_sales != null && r.net_sales > 0 ? (cost / r.net_sales) * 100 : null,
        isTotal: false,
      });
    });
    compositionRows.push({
      store: shortStore(r.store),
      showStore: false,
      label: "Total",
      cost: r.total_cost,
      delta: before ? r.total_cost - before.total_cost : null,
      units: hrs(r.total_hours),
      share: 100,
      shareOfSales: r.labour_pct,
      isTotal: true,
    });
  }

  const compositionColumns: Column<CompositionRow>[] = [
    {
      key: "store",
      header: "Store",
      render: (r) => (
        <span className="text-secondary">{r.showStore ? r.store : ""}</span>
      ),
    },
    {
      key: "label",
      header: "Cost type",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{r.label}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      render: (r) => <span className={r.isTotal ? "font-semibold" : ""}>{gbp(r.cost)}</span>,
    },
    {
      key: "delta",
      header: "Vs last week",
      align: "right",
      render: (r) =>
        r.delta == null ? (
          <span className="text-tertiary">—</span>
        ) : (
          // Cost going UP is the bad direction, so this cannot use deltaClass.
          <span
            className={[
              r.isTotal ? "font-semibold" : "",
              Math.abs(r.delta) < 0.5
                ? "text-tertiary"
                : r.delta > 0
                ? "text-danger"
                : "text-success",
            ].join(" ")}
          >
            {r.delta > 0 ? "+" : "−"}
            {gbp(Math.abs(r.delta))}
          </span>
        ),
    },
    {
      key: "units",
      header: "Hours / units",
      align: "right",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold text-secondary" : "text-secondary"}>
          {r.units}
        </span>
      ),
    },
    {
      key: "share",
      header: "% of labour",
      align: "right",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold" : ""}>
          {r.share == null ? "—" : pct(r.share, 1)}
        </span>
      ),
    },
    {
      key: "shareOfSales",
      header: "% of net sales",
      align: "right",
      render: (r) => (
        <span className={r.isTotal ? "font-semibold" : "text-secondary"}>
          {r.shareOfSales == null ? "—" : pct(r.shareOfSales, 1)}
        </span>
      ),
    },
  ];

  // ---- Band 5 -------------------------------------------------------------
  // Ranked by the money at stake, not by the order the checks happen to run
  // in — the list is cut to five, so a £15 note must not displace a £600 one.
  const exceptions: { text: string; impact: number }[] = [];
  for (const r of weekRows) {
    const target = targetFor(r);
    if (r.labour_pct != null && r.labour_pct > target) {
      const over = r.total_cost - (r.net_sales ?? 0) * (target / 100);
      exceptions.push({
        text: `${shortStore(r.store)} ran ${pct(r.labour_pct, 1)} against a ${target}% target — ${gbp(over)} over.`,
        impact: over,
      });
    }
    const employeeHours = r.ni_hours + r.cash_hours;
    const unplanned = employeeHours - r.rota_hours;
    if (r.rota_hours > 0 && Math.abs(unplanned) > 10) {
      const rate = employeeHours > 0 ? (r.ni_cost + r.cash_cost) / employeeHours : 0;
      exceptions.push({
        text:
          unplanned > 0
            ? `${shortStore(r.store)} worked ${hrs(unplanned)} more than it booked — about ${gbp(unplanned * rate)} of unplanned labour.`
            : `${shortStore(r.store)} booked ${hrs(-unplanned)} more than it worked — the rota is overstating the plan.`,
        impact: Math.abs(unplanned) * rate,
      });
    }
    if (r.cover_driver_cost > 0 && r.total_cost > 0 && r.cover_driver_cost / r.total_cost > 0.15) {
      exceptions.push({
        text: `${shortStore(r.store)} spent ${gbp(r.cover_driver_cost)} on cover drivers — ${pct((r.cover_driver_cost / r.total_cost) * 100, 1)} of its labour bill.`,
        impact: r.cover_driver_cost,
      });
    }
  }
  exceptions.sort((a, b) => b.impact - a.impact);
  return (
    <div className="space-y-7">
      <PageTitle
        title="Labour Cost Performance"
        subtitle={`Approved hours costed against net sales · ${scopeLabel} · ${weekRange(weekIso, match.week_end)}`}
      />

      {labour.load_error && <ErrorState message={labour.load_error} />}

      {noRevenueStores.length > 0 && (
        <div className="rounded-xl border border-dashed border-line bg-surface p-4">
          <p className="text-sm font-medium text-secondary">
            No sales figure for {noRevenueStores.map((r) => shortStore(r.store)).join(" and ")}{" "}
            this week — VM has not synced it and no cash sheet was entered.
          </p>
          <p className="mt-1 text-xs text-tertiary">
            Labour cost is still shown; the percentages are left blank rather than reported as
            0%, which would read as perfect control.
          </p>
        </div>
      )}

      {cashSheetStores.length > 0 && (
        <p className="text-xs text-tertiary">
          Sales for {cashSheetStores.map((r) => shortStore(r.store)).join(" and ")} come from the
          daily cash sheet, not VM — the cash sheet is often only partly filled in, so treat those
          percentages with care.
        </p>
      )}

      <KpiGrid>
        <KpiCard
          label="Labour % of net sales"
          value={cur.labour_pct == null ? "—" : pct(cur.labour_pct, 1)}
          tone={labourGap == null ? undefined : labourGap > 0 ? "bad" : "good"}
          hint={
            labourGap == null
              ? "no sales figure for this week"
              : `${pp(labourGap)} vs ${scopeTarget.toFixed(0)}% target`
          }
          comparisons={[
            { label: "Labour cost", value: gbp(cur.total_cost), pct: costWow },
            {
              label: "Net sales",
              value: cur.net_sales == null ? "—" : gbp(cur.net_sales),
              pct: salesWow,
            },
          ]}
        />

        <KpiCard
          label="Vs labour budget"
          value={
            overspend == null
              ? "—"
              : `${overspend > 0 ? "+" : "−"}${gbp(Math.abs(overspend))}`
          }
          tone={overspend == null ? undefined : overspend > 0 ? "bad" : "good"}
          hint={
            overspend == null || budgetAllowance == null
              ? "no sales figure for this week"
              : `${overspend > 0 ? "over" : "under"} the ${gbp(budgetAllowance)} the target allows`
          }
        />

        <KpiCard
          label="Sales per labour hour"
          value={cur.splh == null ? "—" : `${gbp(cur.splh)}/h`}
          delta={splhWow}
          hint={`${hrs(cur.total_hours)} paid`}
        />

        <KpiCard
          label="Flexible labour"
          value={cur.total_cost > 0 ? pct((cur.variable_cost / cur.total_cost) * 100, 1) : "—"}
          hint={`${gbp(cur.fixed_cost)} is fixed manager wage`}
        />
      </KpiGrid>

      {bridgeText && (
        <p className="text-sm text-secondary">
          {bridgeText}{" "}
          <span className="text-tertiary">
            Sales, hours and the price of an hour are the only three things that can move it.
          </span>
        </p>
      )}

      {compareRows.length > 0 && (
        <Section
          title="Store against store"
          description="The same week, side by side. Each store is measured against its own labour budget, which need not be the same figure."
        >
          <DataTable columns={compareColumns} rows={compareRows} />
        </Section>
      )}

      <Section
        title={`Labour % trend · last ${trendWeeks.length} weeks`}
        description={`Each store against its target, with the scope's trailing 4-week average over the top so a single odd week is not mistaken for a trend. Net sales sit behind as bars. In target on ${weeksInTarget} of the last ${ratedWeeks.length} weeks.`}
      >
        <ChartCard title="Labour % of net sales vs target">
          <ComboChartCard
            data={trendData}
            xKey="week"
            leftSuffix="%"
            bars={[{ key: "Net sales", name: "Net sales" }]}
            lines={[
              ...trendStores.map((s) => ({
                key: `${shortStore(s.store)} labour %`,
                name: `${shortStore(s.store)} labour %`,
              })),
              { key: "4-week average", name: "4-week average", color: "#8b5cf6" },
            ]}
            reference={{ value: scopeTarget, label: `${scopeTarget.toFixed(0)}% target` }}
          />
        </ChartCard>
      </Section>

      <Section
        title="What the labour bill is made of"
        description="The five cost types that make up the P&L labour line. NI/bank hours go through PAYE and never reach the Tuesday payout; everything else is cash. Individual people are on the Employees pages, not here."
      >
        <DataTable columns={compositionColumns} rows={compositionRows} />
      </Section>

      <Section title="Exceptions" description="What is worth acting on this week.">
        <div className="vm-card p-5">
          {exceptions.length === 0 ? (
            <p className="text-sm text-secondary">
              Nothing flagged — labour ran inside target and close to plan.
            </p>
          ) : (
            <ul className="space-y-2">
              {exceptions.slice(0, 5).map((e, i) => (
                <li key={i} className="flex gap-2 text-sm text-primary">
                  <span className="text-tertiary">•</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}
