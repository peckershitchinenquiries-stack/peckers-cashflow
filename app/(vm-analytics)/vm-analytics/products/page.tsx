import { getProducts, getCategories, getWeeks } from "@/lib/vm-analytics/queries";
import { n, gbp, int, weekRange, signedPct, deltaClass } from "@/lib/vm-analytics/format";
import { resolveStore, shortStore } from "@/lib/vm-analytics/constants";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type ProductInput } from "@/lib/vm-analytics/insights";
import type { ProductRow, CategoryRow } from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

interface AggItem {
  item: string;
  units: number;
  revenue: number;
  revWow: number | null;
}

function aggregate(rows: ProductRow[]): AggItem[] {
  const map = new Map<string, AggItem & { wowParts: number[] }>();
  for (const r of rows) {
    const key = r.item_name;
    const cur =
      map.get(key) ??
      { item: key, units: 0, revenue: 0, revWow: null, wowParts: [] as number[] };
    cur.units += n(r.units_sold);
    cur.revenue += n(r.gross_sales);
    if (r.revenue_wow_pct !== null && r.revenue_wow_pct !== undefined)
      cur.wowParts.push(n(r.revenue_wow_pct));
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((c) => ({
      item: c.item,
      units: c.units,
      revenue: c.revenue,
      revWow: c.wowParts.length
        ? c.wowParts.reduce((a, b) => a + b, 0) / c.wowParts.length
        : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);
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
  let cats: CategoryRow[];
  let weekEnd = "";
  try {
    // One getWeeks() call, then fetch products + categories in parallel.
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    [rows, cats] = await Promise.all([getProducts(weekIso), getCategories(weekIso)]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    rows = rows.filter((r) => r.store === activeStore);
    cats = cats.filter((c) => c.store === activeStore);
  }

  if (rows.length === 0) {
    return (
      <>
        <PageTitle title="Product Performance" />
        <EmptyWeek />
      </>
    );
  }

  const items = aggregate(rows);
  const top = items.slice(0, 15);
  const withWow = items.filter((i) => i.revWow !== null);
  const rising = [...withWow].sort((a, b) => (b.revWow! - a.revWow!)).filter((i) => i.revWow! > 0).slice(0, 5);
  const falling = [...withWow].sort((a, b) => (a.revWow! - b.revWow!)).filter((i) => i.revWow! < 0).slice(0, 5);

  const catMap = new Map<string, { cat: string; revenue: number; orders: number }>();
  for (const c of cats) {
    const cur = catMap.get(c.external_category) ?? {
      cat: c.external_category,
      revenue: 0,
      orders: 0,
    };
    cur.revenue += n(c.gross_sales);
    cur.orders += n(c.orders);
    catMap.set(c.external_category, cur);
  }
  const categories = Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue);

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

  const catColumns: Column<{ cat: string; revenue: number; orders: number }>[] = [
    { key: "cat", header: "Category", render: (r) => <span className="font-medium">{r.cat}</span> },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => gbp(r.revenue) },
  ];

  const topChart = top.slice(0, 8).map((t) => ({ item: t.item, Revenue: Math.round(t.revenue) }));

  const insightInput: ProductInput = {
    dashboard: "products",
    week: weekIso,
    top: top.slice(0, 8).map((t) => ({ item: t.item, units: t.units, revenue: t.revenue, revWow: t.revWow })),
    rising: rising.map((r) => ({ item: r.item, revWow: r.revWow! })),
    falling: falling.map((r) => ({ item: r.item, revWow: r.revWow! })),
  };
  const draft = buildInsights(insightInput);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Product Performance"
        subtitle={`Best & worst sellers (${scopeLabel}) · ${weekRange(weekIso, weekEnd)}`}
      />

      <Commentary initial={draft} input={insightInput} />

      <Section title="Top Products" description="Ranked by revenue. Service/delivery-fee lines are excluded.">
        <DataTable columns={productColumns} rows={top} caption="Top 15 menu items" />
      </Section>

      <Section title="Revenue Leaders">
        <ChartCard title="Top 8 products by revenue">
          <BarChartCard
            data={topChart}
            xKey="item"
            bars={[{ key: "Revenue", name: "Revenue" }]}
            currency
            height={320}
          />
        </ChartCard>
      </Section>

      {categories.length > 0 && (
        <Section title="Category Performance" description="Gross sales by external category.">
          <DataTable columns={catColumns} rows={categories} />
        </Section>
      )}
    </div>
  );
}
