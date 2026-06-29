import { getProducts, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import { resolveStore, shortStore } from "@/lib/vm-analytics/constants";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type ProductInput } from "@/lib/vm-analytics/insights";
import type { ProductRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

interface AggItem {
  item: string;
  units: number;
  revenue: number;
  revWow: number | null;
  prevRevenue: number;
  prevUnits: number;
}

// Compute WoW from raw gross_sales across both stores so combined-view WoW is
// (totalCurRevenue - totalPrevRevenue) / totalPrevRevenue — never an average of
// two store percentages, which would give a different (and wrong) result.
function aggregate(rows: ProductRow[], prevRows: ProductRow[]): AggItem[] {
  const prevMap = new Map<string, { revenue: number; units: number }>();
  for (const r of prevRows) {
    const key = `${r.store}::${r.item_name}`;
    const cur = prevMap.get(key) ?? { revenue: 0, units: 0 };
    cur.revenue += n(r.gross_sales);
    cur.units += n(r.units_sold);
    prevMap.set(key, cur);
  }

  const map = new Map<string, { item: string; units: number; revenue: number; prevRevenue: number; prevUnits: number }>();
  for (const r of rows) {
    const key = r.item_name;
    const cur = map.get(key) ?? { item: key, units: 0, revenue: 0, prevRevenue: 0, prevUnits: 0 };
    cur.units += n(r.units_sold);
    cur.revenue += n(r.gross_sales);
    const prev = prevMap.get(`${r.store}::${r.item_name}`);
    if (prev) {
      cur.prevRevenue += prev.revenue;
      cur.prevUnits += prev.units;
    }
    map.set(key, cur);
  }

  return Array.from(map.values())
    .map((c) => ({
      item: c.item,
      units: c.units,
      revenue: c.revenue,
      prevRevenue: c.prevRevenue,
      prevUnits: c.prevUnits,
      revWow: c.prevRevenue > 0 ? (c.revenue - c.prevRevenue) / c.prevRevenue * 100 : null,
    }))
    // Rank by UNITS sold (volume). Prices change week to week, so units are the
    // more stable measure of what's actually popular.
    .sort((a, b) => b.units - a.units);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores combined";

  let weekIso: string | null;
  let rows: ProductRow[];
  let prevRows: ProductRow[] = [];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
    const prevWeekIso = idx >= 0 ? weeks[idx + 1]?.week_start_iso ?? null : null;
    [rows, prevRows] = await Promise.all([
      getProducts(weekIso),
      prevWeekIso ? getProducts(prevWeekIso) : Promise.resolve<ProductRow[]>([]),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    rows = rows.filter((r) => r.store === activeStore);
    prevRows = prevRows.filter((r) => r.store === activeStore);
  }

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Product Performance" />
        <EmptyWeek />
      </>
    );
  }

  const items = aggregate(rows, prevRows);
  const top = items.slice(0, 15);
  const withWow = items.filter((i) => i.revWow !== null);
  const rising = [...withWow].sort((a, b) => (b.revWow! - a.revWow!)).filter((i) => i.revWow! > 0).slice(0, 5);
  const falling = [...withWow].sort((a, b) => (a.revWow! - b.revWow!)).filter((i) => i.revWow! < 0).slice(0, 5);

  const productColumns: Column<AggItem>[] = [
    { key: "item", header: "Product", render: (r) => <span className="font-medium">{r.item}</span> },
    { key: "units", header: "Units Sold", align: "right", render: (r) => int(r.units) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
    {
      key: "wow",
      header: "Revenue WoW",
      align: "right",
      render: (r) => (
        <span className={deltaClass(r.revWow)}>{signedPct(r.revWow)}</span>
      ),
    },
  ];

  const topChart = top.slice(0, 5).map((t) => ({ item: t.item, Units: Math.round(t.units) }));

  const insightInput: ProductInput = {
    dashboard: "products",
    week: weekIso,
    store: activeStore,
    top: top.slice(0, 5).map((t) => ({
      item: t.item,
      units: t.units,
      revenue: t.revenue,
      revWow: t.revWow,
      prevRevenue: t.prevRevenue > 0 ? t.prevRevenue : undefined,
      prevUnits: t.prevUnits > 0 ? t.prevUnits : undefined,
    })),
    rising: rising.map((r) => ({
      item: r.item,
      revWow: r.revWow!,
      revenue: r.revenue,
      prevRevenue: r.prevRevenue,
      units: r.units,
      prevUnits: r.prevUnits,
    })),
    falling: falling.map((r) => ({
      item: r.item,
      revWow: r.revWow!,
      revenue: r.revenue,
      prevRevenue: r.prevRevenue,
      units: r.units,
      prevUnits: r.prevUnits,
    })),
  };
  const draft = buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Product Performance"
        subtitle={`Most & least sellers (${scopeLabel}) · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <Section title="Top Products" description="Ranked by units sold. Service/delivery-fee lines are excluded.">
        <DataTable columns={productColumns} rows={top} caption="Top 15 menu items by volume" />
      </Section>

      <Section title="Volume Leaders">
        <ChartCard title="Top 5 products by units sold">
          <BarChartCard
            data={topChart}
            xKey="item"
            bars={[{ key: "Units", name: "Units" }]}
            height={320}
          />
        </ChartCard>
      </Section>
    </div>
  );
}
