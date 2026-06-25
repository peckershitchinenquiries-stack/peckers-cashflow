import { redirect } from "next/navigation";
import { getLaborCost, getLaborCostWeeks } from "@/lib/vm-analytics/queries";
import { gbp, pct, weekRange } from "@/lib/vm-analytics/format";
import { shortStore } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { LaborCostRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

// Monday (UTC) of the week containing `now`, as YYYY-MM-DD. Used to find the
// "previous complete week" — i.e. the most recent week that started before this
// one.
function currentWeekMondayIso(now = new Date()): string {
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const shift = day === 0 ? -6 : 1 - day; // back up to Monday
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + shift),
  );
  return monday.toISOString().slice(0, 10);
}

export default async function LaborCostPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  // 1. Load the weeks that actually have labor data (cashflow Supabase).
  let weeks;
  try {
    weeks = await getLaborCostWeeks();
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (weeks.length === 0) {
    return (
      <>
        <PageTitle title="Labor Cost Performance" />
        <EmptyWeek message="No labor cost data available. Check that employee_weekly_summary and daily_cash_entries have data." />
      </>
    );
  }

  // 2. No week in the URL → default to the previous *complete* week and write it
  //    into the URL. This keeps the header week-picker in sync with what's shown
  //    (the picker reads ?week=). weeks is sorted newest-first, so the first
  //    entry starting before this Monday is last week.
  if (!searchParams.week) {
    const thisMonday = currentWeekMondayIso();
    const prev = weeks.find((w) => w.week_start_iso < thisMonday) ?? weeks[0];
    redirect(`/vm-analytics/labor-cost?week=${prev.week_start_iso}`);
  }

  // 3. Resolve the requested week (fall back to the latest if it's unknown).
  const match =
    weeks.find((w) => w.week_start_iso === searchParams.week) ?? weeks[0];
  const weekIso = match.week_start_iso;
  const weekEnd = match.week_end;

  // 4. Fetch the rows for that week.
  let rows: LaborCostRow[];
  try {
    rows = await getLaborCost(weekIso);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Labor Cost Performance" />
        <EmptyWeek />
      </>
    );
  }

  // Find total row (which is always last after getLaborCost aggregates)
  const totalRow = rows.find((r) => r.store === "TOTAL");
  const storeRows = rows.filter((r) => r.store !== "TOTAL");

  const n = (val: unknown): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseFloat(val) || 0;
    return 0;
  };

  // KPI metrics from total row
  const totalLabourCost = totalRow ? n(totalRow.labour_cost) : 0;
  const totalRevenue = totalRow ? n(totalRow.revenue) : 0;
  const totalLabourPct = totalRow ? n(totalRow.labour_pct) : 0;

  // Average labour % across stores
  const avgLabourPct =
    storeRows.length > 0 ? storeRows.reduce((sum, r) => sum + n(r.labour_pct), 0) / storeRows.length : 0;

  // Table columns
  type TableRow = LaborCostRow;
  const tableColumns: Column<TableRow>[] = [
    {
      key: "store",
      header: "Store",
      render: (r) => (
        <span className={r.store === "TOTAL" ? "font-semibold" : ""}>{shortStore(r.store)}</span>
      ),
    },
    {
      key: "labour_cost",
      header: "Labor Cost",
      align: "right",
      render: (r) => (
        <span className={r.store === "TOTAL" ? "font-semibold" : ""}>{gbp(n(r.labour_cost))}</span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      render: (r) => (
        <span className={r.store === "TOTAL" ? "font-semibold" : ""}>{gbp(n(r.revenue))}</span>
      ),
    },
    {
      key: "labour_pct",
      header: "Labor %",
      align: "right",
      render: (r) => (
        <span className={r.store === "TOTAL" ? "font-semibold" : ""}>{pct(n(r.labour_pct))}</span>
      ),
    },
  ];

  // Chart data
  const chartData = storeRows.map((r) => ({
    store: shortStore(r.store),
    "Labor Cost": Math.round(n(r.labour_cost)),
    Revenue: Math.round(n(r.revenue)),
  }));

  const labourPctChart = storeRows.map((r) => ({
    store: shortStore(r.store),
    "Labor %": Math.round(n(r.labour_pct) * 10) / 10,
  }));

  return (
    <div className="space-y-7">
      <PageTitle
        title="Labor Cost Performance"
        subtitle={`Labor spend & efficiency metrics · ${weekRange(weekIso, weekEnd)}`}
      />

      <KpiGrid>
        <KpiCard label="Total Labor Cost" value={gbp(totalLabourCost)} />
        <KpiCard label="Total Revenue" value={gbp(totalRevenue)} />
        <KpiCard label="Labor % (Total)" value={pct(totalLabourPct)} />
        <KpiCard label="Avg Labor % (Stores)" value={pct(avgLabourPct)} />
      </KpiGrid>

      <Section title="Labor Cost Summary" description="Breakdown by store with labor % of revenue.">
        <DataTable columns={tableColumns} rows={rows} />
      </Section>

      <Section title="Visual Breakdown">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Labor Cost vs Revenue">
            <BarChartCard
              data={chartData}
              xKey="store"
              bars={[
                { key: "Labor Cost", name: "Labor Cost" },
                { key: "Revenue", name: "Revenue" },
              ]}
              currency
            />
          </ChartCard>
          <ChartCard title="Labor % of Revenue by Store">
            <BarChartCard
              data={labourPctChart}
              xKey="store"
              bars={[{ key: "Labor %", name: "Labor %" }]}
              currency={false}
            />
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}
