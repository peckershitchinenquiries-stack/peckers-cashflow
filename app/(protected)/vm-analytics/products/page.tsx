import {
  getProducts,
  getWeeks,
  getCategoryPerformance,
  getCategoryItems,
} from "@/lib/vm-analytics/queries";
import { n, weekRange } from "@/lib/vm-analytics/format";
import { resolveStore, shortStore, isExcludedProduct } from "@/lib/vm-analytics/constants";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import {
  CategoryPerformanceTable,
  type CategoryPerf,
  type CategoryItem,
} from "@/components/vm-analytics/CategoryPerformanceTable";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { BarChartCard, PieChartCard } from "@/components/vm-analytics/charts/Charts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import { buildInsights, type ProductInput } from "@/lib/vm-analytics/insights";
import type { ProductRow, CategoryPerfRow, ProductCategoryRow } from "@/lib/vm-analytics/types";

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
    .filter((c) => !isExcludedProduct(c.item))
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

// Fold "Churros" into "Desserts" so the two aggregate into one row. Applied to
// every map key in aggregateCategories; all other categories pass through.
const canonicalCategory = (name: string): string =>
  name.toLowerCase() === "churros" ? "Desserts" : name;

// Category-level totals with an item drill-down for the selected scope. WoW is
// recomputed from summed totals (never averaged across stores) so the combined
// view is correct — same principle as aggregate() above. No EXCLUDED_PRODUCTS
// filtering here: the category view deliberately includes Drinks, Fries, etc.
function aggregateCategories(
  catRows: CategoryPerfRow[],
  catPrevRows: CategoryPerfRow[],
  itemRows: ProductCategoryRow[],
  itemPrevRows: ProductCategoryRow[],
): CategoryPerf[] {
  const wow = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

  const sumBy = <T,>(list: T[], key: (r: T) => string, rev: (r: T) => number, units: (r: T) => number) => {
    const m = new Map<string, { revenue: number; units: number }>();
    for (const r of list) {
      const c = m.get(key(r)) ?? { revenue: 0, units: 0 };
      c.revenue += rev(r);
      c.units += units(r);
      m.set(key(r), c);
    }
    return m;
  };

  const curCat = sumBy(catRows, (r) => canonicalCategory(r.category), (r) => n(r.gross_sales), (r) => n(r.units_sold));
  const prevCat = sumBy(catPrevRows, (r) => canonicalCategory(r.category), (r) => n(r.gross_sales), (r) => n(r.units_sold));
  const prevItem = sumBy(itemPrevRows, (r) => `${canonicalCategory(r.category)}::${r.item_name}`, (r) => n(r.gross_sales), (r) => n(r.units_sold));

  const curItems = new Map<string, Map<string, { units: number; revenue: number }>>();
  for (const r of itemRows) {
    const category = canonicalCategory(r.category);
    let byItem = curItems.get(category);
    if (!byItem) {
      byItem = new Map();
      curItems.set(category, byItem);
    }
    const c = byItem.get(r.item_name) ?? { units: 0, revenue: 0 };
    c.units += n(r.units_sold);
    c.revenue += n(r.gross_sales);
    byItem.set(r.item_name, c);
  }

  const cats: CategoryPerf[] = Array.from(curCat.entries()).map(([category, tot]) => {
    const byItem = curItems.get(category) ?? new Map<string, { units: number; revenue: number }>();
    const items: CategoryItem[] = Array.from(byItem.entries())
      .map(([item, it]) => ({
        item,
        units: it.units,
        revenue: it.revenue,
        revWow: wow(it.revenue, prevItem.get(`${category}::${item}`)?.revenue ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);
    return {
      category,
      units: tot.units,
      revenue: tot.revenue,
      revWow: wow(tot.revenue, prevCat.get(category)?.revenue ?? 0),
      items,
    };
  });

  // Drop the Uncategorised data-quality bucket entirely, then revenue desc.
  return cats
    .filter((c) => c.category !== "Uncategorised")
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
  let prevRows: ProductRow[] = [];
  let catRows: CategoryPerfRow[] = [];
  let catPrevRows: CategoryPerfRow[] = [];
  let itemRows: ProductCategoryRow[] = [];
  let itemPrevRows: ProductCategoryRow[] = [];
  let weekEnd = "";
  try {
    const weeks = await getWeeks();
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
    const prevWeekIso = idx >= 0 ? weeks[idx + 1]?.week_start_iso ?? null : null;
    [rows, prevRows, catRows, catPrevRows, itemRows, itemPrevRows] = await Promise.all([
      getProducts(weekIso),
      prevWeekIso ? getProducts(prevWeekIso) : Promise.resolve<ProductRow[]>([]),
      getCategoryPerformance(weekIso),
      prevWeekIso ? getCategoryPerformance(prevWeekIso) : Promise.resolve<CategoryPerfRow[]>([]),
      getCategoryItems(weekIso),
      prevWeekIso ? getCategoryItems(prevWeekIso) : Promise.resolve<ProductCategoryRow[]>([]),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  // Scope to the selected store (or keep both when "All Stores" is chosen).
  if (activeStore) {
    rows = rows.filter((r) => r.store === activeStore);
    prevRows = prevRows.filter((r) => r.store === activeStore);
    catRows = catRows.filter((r) => r.store === activeStore);
    catPrevRows = catPrevRows.filter((r) => r.store === activeStore);
    itemRows = itemRows.filter((r) => r.store === activeStore);
    itemPrevRows = itemPrevRows.filter((r) => r.store === activeStore);
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
  const categoryPerf = aggregateCategories(catRows, catPrevRows, itemRows, itemPrevRows);
  const top = items.slice(0, 5);

  // Category commentary. Add-on categories (Fries, Drinks, etc.) stay in — they
  // are real volume. Only the "Uncategorised" data-quality bucket is excluded.
  const catsForInsight = categoryPerf.filter((c) => c.category !== "Uncategorised");
  const risingCats = [...catsForInsight]
    .filter((c) => c.revWow !== null && c.revWow > 0)
    .sort((a, b) => b.revWow! - a.revWow!)
    .slice(0, 3);
  const fallingCats = [...catsForInsight]
    .filter((c) => c.revWow !== null && c.revWow < 0)
    .sort((a, b) => a.revWow! - b.revWow!)
    .slice(0, 3);

  // revWow = (cur - prev) / prev, so prev = cur / (1 + revWow/100) — exact.
  const prevRevOf = (revenue: number, revWow: number) =>
    revWow !== 0 ? revenue / (1 + revWow / 100) : undefined;

  const topChart = top.map((t) => ({ item: t.item, Units: Math.round(t.units) }));

  // Category revenue-share donut: top 7 categories by revenue, remainder bundled
  // into "Other" so the donut stays legible. Add-on categories are kept in.
  const catShareSorted = [...categoryPerf].sort((a, b) => b.revenue - a.revenue);
  const catShareData = catShareSorted.slice(0, 7).map((c) => ({
    category: c.category,
    revenue: c.revenue,
  }));
  const otherRev = catShareSorted.slice(7).reduce((s, c) => s + c.revenue, 0);
  if (otherRev > 0) catShareData.push({ category: "Other", revenue: otherRev });

  const insightInput: ProductInput = {
    dashboard: "products",
    week: weekIso,
    store: activeStore,
    top: top.map((t) => ({
      item: t.item,
      units: t.units,
      revenue: t.revenue,
      revWow: t.revWow,
      prevRevenue: t.prevRevenue > 0 ? t.prevRevenue : undefined,
      prevUnits: t.prevUnits > 0 ? t.prevUnits : undefined,
    })),
    categories: catsForInsight.map((c) => ({
      category: c.category,
      units: c.units,
      revenue: c.revenue,
      revWow: c.revWow,
    })),
    risingCats: risingCats.map((c) => ({
      category: c.category,
      revenue: c.revenue,
      revWow: c.revWow!,
      prevRevenue: prevRevOf(c.revenue, c.revWow!),
    })),
    fallingCats: fallingCats.map((c) => ({
      category: c.category,
      revenue: c.revenue,
      revWow: c.revWow!,
      prevRevenue: prevRevOf(c.revenue, c.revWow!),
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

      <Section
        title="Category Performance"
        description="Units, revenue and week-on-week per menu category. Click a category to see its items."
      >
        <CategoryPerformanceTable rows={categoryPerf} />
      </Section>

      <Section title="Category Revenue Share">
        <ChartCard title="Share of weekly revenue by category">
          <PieChartCard
            data={catShareData}
            nameKey="category"
            valueKey="revenue"
            height={340}
            showPercent
          />
        </ChartCard>
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
