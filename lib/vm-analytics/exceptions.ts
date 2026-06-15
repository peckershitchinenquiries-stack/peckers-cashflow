// Deterministic "Weekly Exception Report" engine.
//
// Pure function: takes the already-fetched weekly data from every dashboard and
// derives a KPI summary table plus rule-based Opportunities and Risks. Every
// bullet traces back to a concrete number (no AI, no guessing), so the output
// can be cross-checked against the source dashboards.

import { n, gbp0, pct, signedPct } from "@/lib/vm-analytics/format";
import {
  canonicalStore,
  shortStore,
  isThirdPartyPlatform,
  EXCEPTION_THRESHOLDS as T,
} from "@/lib/vm-analytics/constants";
import type {
  ExecRow,
  ProductRow,
  MenuCategoryRow,
  DaypartRow,
  DeliveryRow,
  LaborCostRow,
  AttachmentRow,
  MealDealRow,
} from "@/lib/vm-analytics/types";

export interface KpiTableRow {
  store: string; // "Hitchin" | "Stevenage" | "TOTAL"
  revenue: number;
  orders: number;
  aov: number;
  labourPctOfNet: number | null; // null when no labour data for the store
  deliveryPct: number;
  top3: { name: string; revenue: number }[];
}

export interface Exception {
  text: string; // headline bullet
  detail?: string; // supporting figure / context
}

export interface DeliveryDependenceRow {
  store: string; // "Hitchin" | "Stevenage" | "TOTAL"
  justEatPct: number;
  uberPct: number;
  deliverooPct: number;
  ownDeliveryPct: number;
  thirdPartyPct: number; // platform dependence = Just Eat + Uber + Deliveroo
  allDeliveryPct: number; // third-party + own delivery
  overThreshold: boolean; // thirdPartyPct > platformDependencePct
}

export interface ExceptionReport {
  kpi: KpiTableRow[];
  opportunities: Exception[];
  risks: Exception[];
  deliveryDependence: DeliveryDependenceRow[];
  platformThreshold: number;
  labourDataPartial: boolean; // cross-check: labour % implausibly low → rota likely incomplete
}

export interface ExceptionInputs {
  exec: ExecRow[];
  products: ProductRow[];
  categories: MenuCategoryRow[];
  dayparts: DaypartRow[];
  delivery: DeliveryRow[];
  labour: LaborCostRow[];
  attachment: AttachmentRow[];
  mealDeals: MealDealRow[];
}

export function buildExceptionReport(input: ExceptionInputs): ExceptionReport {
  const { exec, products, categories, dayparts, delivery, labour, attachment, mealDeals } = input;

  const deliveryDependence = computeDeliveryDependence(delivery);

  // --- Labour cost per canonical store (skip the TOTAL row) ----------------
  const labourByStore = new Map<string, number>();
  for (const r of labour) {
    const key = canonicalStore(r.store);
    if (key === "TOTAL") continue;
    labourByStore.set(key, n(r.labour_cost));
  }

  // --- KPI table -----------------------------------------------------------
  const kpi: KpiTableRow[] = [];
  let totRevenue = 0,
    totOrders = 0,
    totLabour = 0,
    totDeliverySales = 0;

  for (const e of exec) {
    const key = canonicalStore(e.store);
    const revenue = n(e.net_sales);
    const orders = n(e.number_of_orders);
    const labourCost = labourByStore.get(key);
    const labourPct = labourCost != null && revenue > 0 ? (labourCost / revenue) * 100 : null;

    kpi.push({
      store: key,
      revenue,
      orders,
      aov: n(e.aov),
      labourPctOfNet: labourPct,
      deliveryPct: n(e.delivery_pct),
      top3: topProductsForStore(products, e.store, 3),
    });

    totRevenue += revenue;
    totOrders += orders;
    totLabour += labourCost ?? 0;
    totDeliverySales += n(e.delivery_sales_amount);
  }

  // Sort stores alphabetically for a stable Hitchin → Stevenage order.
  kpi.sort((a, b) => a.store.localeCompare(b.store));

  const totalRow: KpiTableRow = {
    store: "TOTAL",
    revenue: totRevenue,
    orders: totOrders,
    aov: totOrders > 0 ? totRevenue / totOrders : 0,
    labourPctOfNet: totLabour > 0 && totRevenue > 0 ? (totLabour / totRevenue) * 100 : null,
    deliveryPct: totRevenue > 0 ? (totDeliverySales / totRevenue) * 100 : 0,
    top3: topProductsAcrossStores(products, 3),
  };
  kpi.push(totalRow);

  // Cross-check: scheduled rota wages well under ~15% of net usually means the
  // rota isn't fully entered — flag rather than silently show a misleading %.
  const labourDataPartial =
    totalRow.labourPctOfNet != null && totalRow.labourPctOfNet < 15;

  // --- OPPORTUNITIES -------------------------------------------------------
  const opportunities: Exception[] = [];

  // Best-performing product (combined across stores, by revenue)
  const bestProduct = topProductsAcrossStores(products, 1)[0];
  if (bestProduct) {
    opportunities.push({
      text: `Best seller: ${bestProduct.name}`,
      detail: `${gbp0(bestProduct.revenue)} revenue · ${Math.round(bestProduct.units)} units`,
    });
  }

  // Fastest-growing category (single store/category with the largest positive WoW)
  const fastCat = fastestCategory(categories);
  if (fastCat) {
    opportunities.push({
      text: `Fastest-growing category: ${fastCat.name}`,
      detail: `${signedPct(fastCat.wow)} WoW at ${shortStore(fastCat.store)} (${gbp0(fastCat.sales)})`,
    });
  }

  // Highest-performing store (by net sales)
  const storeRows = kpi.filter((k) => k.store !== "TOTAL");
  if (storeRows.length > 0) {
    const top = [...storeRows].sort((a, b) => b.revenue - a.revenue)[0];
    const execTop = exec.find((e) => canonicalStore(e.store) === top.store);
    const wow = execTop ? n(execTop.net_sales_wow_pct) : 0;
    opportunities.push({
      text: `Top store: ${top.store}`,
      detail: `${gbp0(top.revenue)} net sales${execTop ? ` (${signedPct(wow)} WoW)` : ""}`,
    });
  }

  // Strongest daypart (combined revenue across stores)
  const strongDaypart = strongestDaypart(dayparts);
  if (strongDaypart) {
    opportunities.push({
      text: `Strongest daypart: ${strongDaypart.name}`,
      detail: `${gbp0(strongDaypart.revenue)} · ${Math.round(strongDaypart.orders)} orders/day`,
    });
  }

  // Upselling: meal-deal penetration + strongest add-on attachment
  const upsell = upsellOpportunity(mealDeals, attachment, kpi);
  if (upsell) opportunities.push(upsell);

  // --- RISKS ---------------------------------------------------------------
  const risks: Exception[] = [];

  // Sales decline > 5% WoW (per store)
  for (const e of exec) {
    const wow = n(e.net_sales_wow_pct);
    if (wow <= T.salesDeclinePct) {
      risks.push({
        text: `${shortStore(e.store)} sales fell ${pct(Math.abs(wow))} WoW`,
        detail: `Net sales ${gbp0(e.net_sales)} (threshold ${T.salesDeclinePct}%)`,
      });
    }
  }

  // Labour % above target (per store)
  for (const k of kpi) {
    if (k.store === "TOTAL") continue;
    if (k.labourPctOfNet != null && k.labourPctOfNet > T.labourTargetPct) {
      risks.push({
        text: `${k.store} labour above target`,
        detail: `${pct(k.labourPctOfNet)} of net sales (target ${T.labourTargetPct}%)`,
      });
    }
  }

  // Falling attachment rates (popular items that dropped notably WoW)
  for (const a of fallingAttachment(attachment)) {
    risks.push({
      text: `${a.item} attachment falling at ${shortStore(a.store)}`,
      detail: `${pct(a.prev)} → ${pct(a.now)} (${a.delta >= 0 ? "+" : ""}${a.delta.toFixed(1)} pp)`,
    });
  }

  // Underperforming menu items (meaningful volume, sharp revenue drop). Product
  // rows are per-store, so name the store — an item can decline at one store
  // while still selling well at the other.
  for (const p of underperformingItems(products)) {
    risks.push({
      text: `Declining item: ${p.name} (${shortStore(p.store)})`,
      detail: `${signedPct(p.wow)} revenue WoW · ${Math.round(p.units)} units`,
    });
  }

  // Third-party platform dependence, per store (excludes Own Delivery)
  for (const d of deliveryDependence) {
    if (d.store !== "TOTAL" && d.overThreshold) {
      risks.push({
        text: `${d.store} third-party platform dependence`,
        detail: `${pct(d.thirdPartyPct)} via Just Eat / Uber / Deliveroo (threshold ${T.platformDependencePct}%)`,
      });
    }
  }

  return {
    kpi,
    opportunities,
    risks,
    deliveryDependence,
    platformThreshold: T.platformDependencePct,
    labourDataPartial,
  };
}

// Per-store delivery split into third-party platforms vs own delivery. Shares
// are each platform's gross ÷ the store's total gross (all channels).
function computeDeliveryDependence(delivery: DeliveryRow[]): DeliveryDependenceRow[] {
  interface Acc {
    justEat: number;
    uber: number;
    deliveroo: number;
    own: number;
    total: number;
  }
  const byStore = new Map<string, Acc>();
  const ensure = (k: string) =>
    byStore.get(k) ?? byStore.set(k, { justEat: 0, uber: 0, deliveroo: 0, own: 0, total: 0 }).get(k)!;

  for (const r of delivery) {
    const key = canonicalStore(r.store);
    const acc = ensure(key);
    const gross = n(r.gross_sales);
    acc.total += gross;
    const p = (r.platform ?? "").toLowerCase();
    if (r.bucket === "delivery") {
      if (p.includes("just eat")) acc.justEat += gross;
      else if (p.includes("uber")) acc.uber += gross;
      else if (p.includes("deliveroo")) acc.deliveroo += gross;
      else if (p.includes("own")) acc.own += gross;
      else if (isThirdPartyPlatform(p)) acc.justEat += gross; // any other 3P → bucket with platforms
    }
  }

  // Aggregate TOTAL across stores.
  const total: Acc = { justEat: 0, uber: 0, deliveroo: 0, own: 0, total: 0 };
  for (const a of byStore.values()) {
    total.justEat += a.justEat;
    total.uber += a.uber;
    total.deliveroo += a.deliveroo;
    total.own += a.own;
    total.total += a.total;
  }

  const toRow = (store: string, a: Acc): DeliveryDependenceRow => {
    const pctOf = (v: number) => (a.total > 0 ? (v / a.total) * 100 : 0);
    const thirdPartyPct = pctOf(a.justEat + a.uber + a.deliveroo);
    return {
      store,
      justEatPct: pctOf(a.justEat),
      uberPct: pctOf(a.uber),
      deliverooPct: pctOf(a.deliveroo),
      ownDeliveryPct: pctOf(a.own),
      thirdPartyPct,
      allDeliveryPct: pctOf(a.justEat + a.uber + a.deliveroo + a.own),
      overThreshold: thirdPartyPct > T.platformDependencePct,
    };
  };

  const rows = [...byStore.entries()]
    .map(([store, a]) => toRow(store, a))
    .sort((x, y) => x.store.localeCompare(y.store));
  if (rows.length > 0) rows.push(toRow("TOTAL", total));
  return rows;
}

// --- helpers ---------------------------------------------------------------

function topProductsForStore(products: ProductRow[], store: string, limit: number) {
  return products
    .filter((p) => p.store === store)
    .sort((a, b) => n(b.gross_sales) - n(a.gross_sales))
    .slice(0, limit)
    .map((p) => ({ name: p.item_name, revenue: n(p.gross_sales) }));
}

function topProductsAcrossStores(products: ProductRow[], limit: number) {
  const agg = new Map<string, { revenue: number; units: number }>();
  for (const p of products) {
    const cur = agg.get(p.item_name) ?? { revenue: 0, units: 0 };
    cur.revenue += n(p.gross_sales);
    cur.units += n(p.units_sold);
    agg.set(p.item_name, cur);
  }
  return [...agg.entries()]
    .map(([name, v]) => ({ name, revenue: v.revenue, units: v.units }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function fastestCategory(categories: MenuCategoryRow[]) {
  const candidates = categories
    .filter((c) => n(c.gross_sales) >= 150 && c.gross_sales_wow_pct != null)
    .map((c) => ({
      name: c.category,
      store: c.store,
      wow: n(c.gross_sales_wow_pct),
      sales: n(c.gross_sales),
    }))
    .filter((c) => c.wow > 0 && c.name && c.name.trim() !== "");
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.wow - a.wow)[0];
}

function strongestDaypart(dayparts: DaypartRow[]) {
  const agg = new Map<string, { revenue: number; orders: number }>();
  for (const d of dayparts) {
    const cur = agg.get(d.daypart) ?? { revenue: 0, orders: 0 };
    cur.revenue += n(d.revenue);
    cur.orders += n(d.orders);
    agg.set(d.daypart, cur);
  }
  const rows = [...agg.entries()].map(([name, v]) => ({ name, ...v }));
  if (rows.length === 0) return null;
  return rows.sort((a, b) => b.revenue - a.revenue)[0];
}

function upsellOpportunity(
  mealDeals: MealDealRow[],
  attachment: AttachmentRow[],
  kpi: KpiTableRow[],
): Exception | null {
  // Meal-deal penetration = deal baskets / orders, per store; report the store
  // where meal deals grew (or the highest-penetration store otherwise).
  const ordersByStore = new Map(kpi.map((k) => [k.store, k.orders]));
  const deals = mealDeals
    .map((m) => {
      const key = canonicalStore(m.store);
      const orders = ordersByStore.get(key) ?? 0;
      return {
        store: key,
        baskets: n(m.deal_baskets),
        delta: n(m.deal_baskets_delta),
        penetration: orders > 0 ? (n(m.deal_baskets) / orders) * 100 : 0,
      };
    })
    .sort((a, b) => b.delta - a.delta);

  const grew = deals.find((d) => d.delta > 0) ?? deals[0];
  // Strongest add-on by attachment (anchor for bundling)
  const topAttach = [...attachment].sort((a, b) => n(b.attach_pct) - n(a.attach_pct))[0];

  if (!grew && !topAttach) return null;
  const parts: string[] = [];
  if (grew) {
    parts.push(
      `meal deals ${grew.delta >= 0 ? "+" : ""}${grew.delta} baskets at ${grew.store} (${pct(grew.penetration)} of orders)`,
    );
  }
  if (topAttach) {
    parts.push(`${topAttach.item_name} attaches to ${pct(topAttach.attach_pct)} of orders`);
  }
  return {
    text: `Upselling: bundle high-attach add-ons`,
    detail: parts.join(" · "),
  };
}

function fallingAttachment(attachment: AttachmentRow[]) {
  return attachment
    .filter(
      (a) =>
        a.prev_attach_pct != null &&
        n(a.attach_pct) >= T.attachMinOrdersPct &&
        n(a.attach_pct_delta) <= -T.attachDropPp,
    )
    .sort((a, b) => n(a.attach_pct_delta) - n(b.attach_pct_delta))
    .slice(0, 3)
    .map((a) => ({
      item: a.item_name,
      store: a.store,
      now: n(a.attach_pct),
      prev: n(a.prev_attach_pct),
      delta: n(a.attach_pct_delta),
    }));
}

function underperformingItems(products: ProductRow[]) {
  return products
    .filter(
      (p) =>
        p.revenue_wow_pct != null &&
        n(p.units_sold) >= T.productMinUnits &&
        n(p.revenue_wow_pct) <= T.productDeclinePct,
    )
    .sort((a, b) => n(a.revenue_wow_pct) - n(b.revenue_wow_pct))
    .slice(0, 3)
    .map((p) => ({
      name: p.item_name,
      store: p.store,
      wow: n(p.revenue_wow_pct),
      units: n(p.units_sold),
    }));
}
