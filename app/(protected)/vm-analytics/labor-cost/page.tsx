import { redirect } from "next/navigation";
import {
  getLabourByStoreWeek,
  getLabourTargets,
  getLabourWeekdayBreakdown,
  getLabourWeeks,
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
const pctTrunc = (v: number) => `${(Math.trunc(v * 100) / 100).toFixed(2)}%`;

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
  return {
    ni_cost: add("ni_cost"),
    ni_hours: add("ni_hours"),
    cash_cost: add("cash_cost"),
    cash_hours: add("cash_hours"),
    delivery_cost: add("delivery_cost"),
    deliveries: add("deliveries"),
    manager_cost: add("manager_cost"),
    manager_days: add("manager_days"),
    manager_hours: add("manager_hours"),
    cover_driver_cost: add("cover_driver_cost"),
    cover_driver_hours: add("cover_driver_hours"),
    total_cost,
    total_hours: add("total_hours"),
    rota_hours: add("rota_hours"),
    unapproved_days: add("unapproved_days"),
    net_sales: net,
    labour_pct: net != null && net > 0 ? (total_cost / net) * 100 : null,
  };
}

/** Background tint scaled against the week's own average for that measure. */
function shade(value: number | null, avg: number, invert = false): string {
  if (value == null || !(avg > 0)) return "";
  const ratio = value / avg;
  const hot = invert ? ratio < 1 : ratio > 1;
  const strength = Math.min(1, Math.abs(ratio - 1) / 0.5);
  if (strength < 0.12) return "";
  const alpha = (0.08 + strength * 0.22).toFixed(3);
  return hot ? `rgba(225, 29, 42, ${alpha})` : `rgba(16, 185, 129, ${alpha})`;
}

function Cell({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 tabular-nums"
      style={tint ? { backgroundColor: tint } : undefined}
    >
      {children}
    </span>
  );
}

type CompositionRow = {
  store: string;
  showStore: boolean;
  label: string;
  cost: number;
  units: string;
  share: number | null;
  isTotal: boolean;
};

type WeekdayMetricRow = {
  metric: string;
  cells: { text: string; tint: string }[];
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
  const [labour, targets, weekday] = await Promise.all([
    getLabourByStoreWeek(trendWeeks),
    getLabourTargets([weekIso]),
    getLabourWeekdayBreakdown(weekIso),
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

  // ---- Band 2 -------------------------------------------------------------
  const trendStores = Array.from(
    new Map(weekRows.map((r) => [r.store_id, r])).values(),
  );
  const trendData = [...trendWeeks].reverse().map((w) => {
    const point: Record<string, unknown> = {
      week: weekRange(w),
    };
    let net = 0;
    for (const s of trendStores) {
      const row = labour.rows.find((r) => r.week_start === w && r.store_id === s.store_id);
      point[`${shortStore(s.store)} labour %`] = row?.labour_pct ?? null;
      net += row?.net_sales ?? 0;
    }
    point["Net sales"] = Math.round(net);
    return point;
  });

  // ---- Band 3 -------------------------------------------------------------
  const compositionRows: CompositionRow[] = [];
  for (const r of weekRows) {
    const parts: Array<[string, number, string]> = [
      ["NI / bank hours (PAYE)", r.ni_cost, hrs(r.ni_hours)],
      ["Cash hours", r.cash_cost, hrs(r.cash_hours)],
      ["Delivery pay", r.delivery_cost, `${int(r.deliveries)} drops`],
      ["Manager fixed wage", r.manager_cost, `${int(r.manager_days)} days`],
      ["Cover drivers", r.cover_driver_cost, hrs(r.cover_driver_hours)],
    ];
    parts.forEach(([label, cost, units], i) => {
      compositionRows.push({
        store: shortStore(r.store),
        showStore: i === 0,
        label,
        cost,
        units,
        share: r.total_cost > 0 ? (cost / r.total_cost) * 100 : null,
        isTotal: false,
      });
    });
    compositionRows.push({
      store: shortStore(r.store),
      showStore: false,
      label: "Total",
      cost: r.total_cost,
      units: hrs(r.total_hours),
      share: 100,
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
  ];

  // ---- Band 4 -------------------------------------------------------------
  const weekdayStores = weekday.stores.filter(inScope);
  const weekdayTables = weekdayStores.map((s) => {
    const days = s.days;
    const avg = (pick: (d: (typeof days)[number]) => number | null) => {
      const vals = days.map(pick).filter((v): v is number => v != null && v > 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const avgSales = avg((d) => d.net_sales);
    const avgHours = avg((d) => d.hours);
    const avgCost = avg((d) => d.cost);
    const avgPct = avg((d) => d.labour_pct);
    const avgSplh = avg((d) => d.splh);

    const rows: WeekdayMetricRow[] = [
      {
        metric: "Net sales",
        cells: days.map((d) => ({
          text: d.net_sales == null ? "—" : gbp(d.net_sales),
          tint: shade(d.net_sales, avgSales, true),
        })),
      },
      {
        metric: "Labour hours",
        cells: days.map((d) => ({ text: hrs(d.hours), tint: shade(d.hours, avgHours) })),
      },
      {
        metric: "Labour £",
        cells: days.map((d) => ({ text: gbp(d.cost), tint: shade(d.cost, avgCost) })),
      },
      {
        metric: "Labour %",
        cells: days.map((d) => ({
          text: d.labour_pct == null ? "—" : pct(d.labour_pct, 1),
          tint: shade(d.labour_pct, avgPct),
        })),
      },
      {
        metric: "SPLH",
        cells: days.map((d) => ({
          text: d.splh == null ? "—" : `${gbp(d.splh)}/h`,
          tint: shade(d.splh, avgSplh, true),
        })),
      },
    ];

    const columns: Column<WeekdayMetricRow>[] = [
      {
        key: "metric",
        header: "",
        render: (r) => <span className="font-medium text-secondary">{r.metric}</span>,
      },
      ...days.map((d, i) => ({
        key: `d${i}`,
        header: d.weekday.slice(0, 3),
        align: "right" as const,
        render: (r: WeekdayMetricRow) => (
          <Cell tint={r.cells[i].tint}>{r.cells[i].text}</Cell>
        ),
      })),
    ];

    return { store: shortStore(s.store), columns, rows };
  });

  // ---- Band 5 -------------------------------------------------------------
  const exceptions: string[] = [];
  for (const r of weekRows) {
    const target = targetFor(r);
    if (r.labour_pct != null && r.labour_pct > target) {
      const over = r.total_cost - (r.net_sales ?? 0) * (target / 100);
      exceptions.push(
        `${shortStore(r.store)} ran ${pct(r.labour_pct, 1)} against a ${target}% target — ${gbp(over)} over.`,
      );
    }
    const unplanned = r.total_hours - r.rota_hours;
    if (r.rota_hours > 0 && Math.abs(unplanned) > 10) {
      const rate = r.total_hours > 0 ? r.total_cost / r.total_hours : 0;
      exceptions.push(
        unplanned > 0
          ? `${shortStore(r.store)} worked ${hrs(unplanned)} more than it booked — about ${gbp(unplanned * rate)} of unplanned labour.`
          : `${shortStore(r.store)} booked ${hrs(-unplanned)} more than it worked — the rota is overstating the plan.`,
      );
    }
    if (r.cover_driver_cost > 0 && r.total_cost > 0 && r.cover_driver_cost / r.total_cost > 0.15) {
      exceptions.push(
        `${shortStore(r.store)} spent ${gbp(r.cover_driver_cost)} on cover drivers — ${pct((r.cover_driver_cost / r.total_cost) * 100, 1)} of its labour bill.`,
      );
    }
  }
  for (const s of weekdayStores) {
    const rated = s.days.filter((d) => d.labour_pct != null);
    if (rated.length < 3) continue;
    const worst = rated.reduce((a, b) => (b.labour_pct! > a.labour_pct! ? b : a));
    exceptions.push(
      `${shortStore(s.store)}'s worst day was ${worst.weekday} at ${pct(worst.labour_pct!, 1)} — ${hrs(worst.hours)} against ${gbp(worst.net_sales ?? 0)} of sales.`,
    );
  }
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
          value={cur.labour_pct == null ? "—" : pctTrunc(cur.labour_pct)}
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
      </KpiGrid>

      <Section
        title={`Labour % trend · last ${trendWeeks.length} weeks`}
        description="Each store against its target. Net sales sit behind as bars, so a labour % that moves because trade moved is visible as such."
      >
        <ChartCard title="Labour % of net sales vs target">
          <ComboChartCard
            data={trendData}
            xKey="week"
            leftSuffix="%"
            bars={[{ key: "Net sales", name: "Net sales" }]}
            lines={trendStores.map((s) => ({
              key: `${shortStore(s.store)} labour %`,
              name: `${shortStore(s.store)} labour %`,
            }))}
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

      <Section
        title="Labour against demand, by day"
        description="Each cell is shaded against that week's own average — red is worse, green better. Day sales are the week's net total split by the weekday sales shape, so the days sum to the week."
      >
        {weekday.load_error && (
          <p className="text-xs text-warning">
            Weekday sales unavailable ({weekday.load_error}) — hours and cost are still exact.
          </p>
        )}
        <div className="space-y-4">
          {weekdayTables.map((t) => (
            <DataTable key={t.store} caption={t.store} columns={t.columns} rows={t.rows} />
          ))}
        </div>
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
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}
