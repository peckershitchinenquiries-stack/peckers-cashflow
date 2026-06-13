import { getLaborCost, resolveWeek, getLaborCostWeeks } from "@/lib/vm-analytics/queries";
import { gbp, pct, weekRange } from "@/lib/vm-analytics/format";
import { shortStore } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type { LaborCostRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

export default async function LaborCostPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  let weekIso: string | null;
  let rows: LaborCostRow[];
  let weekEnd = "";

  try {
    // Get available weeks from cashflow Supabase (labor cost data)
    const weeks = await getLaborCostWeeks();

    if (weeks.length === 0) {
      return (
        <>
          <PageTitle title="Labor Cost Performance" />
          <EmptyWeek message="No labor cost data available. Check that employee_weekly_summary and daily_cash_entries have data." />
        </>
      );
    }

    // Resolve week: use requested week or default to latest
    if (searchParams.week) {
      weekIso = weeks.find((w) => w.week_start_iso === searchParams.week)?.week_start_iso ?? null;
    }
    if (!weekIso) {
      weekIso = weeks[0]?.week_start_iso ?? null;
    }
    if (!weekIso) return <EmptyWeek />;

    rows = await getLaborCost(weekIso);
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
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
