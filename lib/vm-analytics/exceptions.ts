// Deterministic "Weekly Exception Report" engine.
//
// Pure function: takes the already-fetched weekly data from every dashboard and
// derives a KPI summary table plus rule-based Opportunities and Risks, written
// as plain-English sentences a non-technical owner can act on. Every line traces
// back to a concrete number (no AI, no guessing) so the output can be
// cross-checked against the source dashboards.
//
// Money is shown to the penny — never rounded. AOV is always split into Delivery
// AOV and In-store AOV. The report is scoped to one store when `activeStore` is
// set, otherwise it covers both stores with a combined TOTAL.

import { n, pct } from "@/lib/vm-analytics/format";
import {
  canonicalStore,
  shortStore,
  isThirdPartyPlatform,
  isExcludedProduct,
  EXCEPTION_THRESHOLDS as T,
} from "@/lib/vm-analytics/constants";
import { buildBreakdown } from "@/lib/vm-analytics/channels";
import type {
  ExecRow,
  ExecChannelRow,
  ProductRow,
  DaypartRow,
  DeliveryRow,
  LaborCostRow,
  MealDealRow,
} from "@/lib/vm-analytics/types";

// Money to the penny — no rounding anywhere in this report.
const money = (v: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);

// Exact counts (units / orders) — never rounded.
const count = (v: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(v || 0);

export interface KpiTableRow {
  store: string; // "Hitchin" | "Stevenage" | "TOTAL"
  revenue: number;
  orders: number;
  deliveryAov: number;
  inStoreAov: number;
  labourPctOfNet: number | null; // null when no labour data for the store
  deliveryPct: number;
  inStorePct: number;
  top3: { name: string; revenue: number; units: number }[];
}

export interface Exception {
  text: string; // plain-English headline
  detail?: string; // optional supporting line
}

export interface DeliveryDependenceRow {
  store: string; // "Hitchin" | "Stevenage" | "TOTAL"
  justEatPct: number;
  uberPct: number;
  deliverooPct: number;
  ownDeliveryPct: number;
  aggregatorPct: number; // Just Eat + Uber + Deliveroo (commission-charging)
  allDeliveryPct: number; // aggregator + own delivery
  overThreshold: boolean; // aggregatorPct > platformDependencePct
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
  channels: ExecChannelRow[];
  products: ProductRow[];
  dayparts: DaypartRow[];
  delivery: DeliveryRow[];
  labour: LaborCostRow[];
  mealDeals: MealDealRow[];
  // Canonical store name when scoped to one store ("Peckers Hitchin" / …),
  // otherwise null for the combined both-stores view.
  activeStore: string | null;
}

export function buildExceptionReport(input: ExceptionInputs): ExceptionReport {
  const { exec, channels, dayparts, delivery, labour, mealDeals, activeStore } = input;
  // Drop drinks/side add-ons so they don't drive top-3, best-seller, or risks —
  // matches the Product Performance dashboard's exclusion (shared list).
  const products = input.products.filter((p) => !isExcludedProduct(p.item_name));
  const singleStore = activeStore != null;
  const storeScope = activeStore ? shortStore(activeStore) : "both stores";

  const deliveryDependence = computeDeliveryDependence(delivery, singleStore);

  // --- Labour cost per canonical store (skip the TOTAL row) ----------------
  const labourByStore = new Map<string, number>();
  for (const r of labour) {
    const key = canonicalStore(r.store);
    if (key === "TOTAL") continue;
    labourByStore.set(key, n(r.labour_cost));
  }

  // --- KPI table -----------------------------------------------------------
  // Delivery / in-store AOV + delivery % come from the shared channel breakdown,
  // so they line up exactly with the Executive dashboard.
  const kpi: KpiTableRow[] = [];
  let totRevenue = 0,
    totOrders = 0,
    totLabour = 0;

  for (const e of exec) {
    const key = canonicalStore(e.store);
    const b = buildBreakdown([e.store], exec, channels);
    const labourCost = labourByStore.get(key);
    const labourPct = labourCost != null && b.netSales > 0 ? (labourCost / b.netSales) * 100 : null;

    kpi.push({
      store: key,
      revenue: b.netSales,
      orders: b.orders,
      deliveryAov: b.delivery.aov,
      inStoreAov: b.inStore.aov,
      labourPctOfNet: labourPct,
      deliveryPct: b.deliveryPct,
      inStorePct: b.inStorePct,
      top3: topProductsForStore(products, e.store, 3),
    });

    totRevenue += b.netSales;
    totOrders += b.orders;
    totLabour += labourCost ?? 0;
  }

  // Sort stores alphabetically for a stable Hitchin → Stevenage order.
  kpi.sort((a, b) => a.store.localeCompare(b.store));

  // A combined TOTAL only adds information when both stores are shown.
  if (!singleStore) {
    const allStores = exec.map((e) => e.store);
    const bAll = buildBreakdown(allStores, exec, channels);
    kpi.push({
      store: "TOTAL",
      revenue: bAll.netSales,
      orders: bAll.orders,
      deliveryAov: bAll.delivery.aov,
      inStoreAov: bAll.inStore.aov,
      labourPctOfNet: totLabour > 0 && totRevenue > 0 ? (totLabour / totRevenue) * 100 : null,
      deliveryPct: bAll.deliveryPct,
      inStorePct: bAll.inStorePct,
      top3: topProductsAcrossStores(products, 3),
    });
  }

  // Cross-check: scheduled rota wages well under ~15% of net usually means the
  // rota isn't fully entered — flag rather than silently show a misleading %.
  const labourCheckRow = singleStore ? kpi[0] : kpi[kpi.length - 1];
  const labourDataPartial =
    labourCheckRow?.labourPctOfNet != null && labourCheckRow.labourPctOfNet < 15;

  // --- OPPORTUNITIES (plain-English) ---------------------------------------
  const opportunities: Exception[] = [];

  // Best-selling product (by units — the most stable measure of popularity).
  const bestProduct = topProductsAcrossStores(products, 1)[0];
  if (bestProduct) {
    opportunities.push({
      text: `The best seller at ${storeScope} this week was the ${bestProduct.name}, selling ${count(
        bestProduct.units
      )} units and bringing in ${money(bestProduct.revenue)}.`,
    });
  }

  // Strongest site (only meaningful with both stores in view).
  if (!singleStore) {
    const storeRows = kpi.filter((k) => k.store !== "TOTAL");
    if (storeRows.length > 0) {
      const top = [...storeRows].sort((a, b) => b.revenue - a.revenue)[0];
      const execTop = exec.find((e) => canonicalStore(e.store) === top.store);
      const wow = execTop ? n(execTop.net_sales_wow_pct) : null;
      opportunities.push({
        text: `${top.store} was the stronger site, taking ${money(top.revenue)} in net sales${
          wow != null ? ` (${pct(wow)} week-on-week)` : ""
        }.`,
      });
    }
  }

  // Busiest daypart (combined revenue across the scope).
  const strongDaypart = strongestDaypart(dayparts);
  if (strongDaypart) {
    opportunities.push({
      text: `The busiest time of day was ${strongDaypart.name.toLowerCase()}, taking ${money(
        strongDaypart.revenue
      )} across ${count(strongDaypart.orders)} orders a day — the prime window to push add-ons.`,
    });
  }

  // Upselling: meal-deal penetration.
  const upsell = upsellOpportunity(mealDeals, kpi);
  if (upsell) opportunities.push(upsell);

  // --- RISKS (plain-English, no thresholds in the wording) -----------------
  const risks: Exception[] = [];

  // Sales decline week-on-week, per store.
  for (const e of exec) {
    const wow = n(e.net_sales_wow_pct);
    if (wow <= T.salesDeclinePct) {
      const b = buildBreakdown([e.store], exec, channels);
      risks.push({
        text: `${shortStore(e.store)} sales slipped ${pct(Math.abs(wow))} week-on-week to ${money(
          b.netSales
        )} — worth a closer look at what changed.`,
      });
    }
  }

  // Labour above the target you aim for, per store.
  for (const k of kpi) {
    if (k.store === "TOTAL") continue;
    if (k.labourPctOfNet != null && k.labourPctOfNet > T.labourTargetPct) {
      risks.push({
        text: `${k.store}'s labour ran at ${pct(
          k.labourPctOfNet
        )} of net sales, above the ${T.labourTargetPct}% target — check the rota against trade.`,
      });
    }
  }

  // Menu items losing momentum (real volume, sharp revenue drop) — told as a
  // story, with no threshold numbers cluttering the message. Display units WoW
  // (clearer than revenue WoW, which can shift due to price changes).
  for (const p of underperformingItems(products)) {
    risks.push({
      text: `The ${p.name} at ${shortStore(p.store)} is slowing down — ${count(
        p.units
      )} units sold, down ${pct(Math.abs(p.unitsWow))} on last week.`,
    });
  }

  // Aggregator (commission platform) dependence, per store.
  for (const d of deliveryDependence) {
    if (d.store !== "TOTAL" && d.overThreshold) {
      risks.push({
        text: `${d.store} leans on delivery aggregators for ${pct(
          d.aggregatorPct
        )} of sales (Just Eat, Uber Eats, Deliveroo) — that's commission you could win back by growing own delivery, currently ${pct(
          d.ownDeliveryPct
        )}.`,
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

// Per-store delivery split into aggregator platforms vs own delivery. Shares are
// each platform's NET sales ÷ the store's total NET sales (all channels), so the
// figures reconcile exactly with the Executive / Delivery dashboards (which are
// all net-based). E.g. Hitchin aggregator = agg net ÷ store net, not gross.
function computeDeliveryDependence(
  delivery: DeliveryRow[],
  singleStore: boolean
): DeliveryDependenceRow[] {
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
    const net = n(r.net_sales);
    acc.total += net;
    const p = (r.platform ?? "").toLowerCase();
    if (r.bucket === "delivery") {
      if (p.includes("just eat")) acc.justEat += net;
      else if (p.includes("uber")) acc.uber += net;
      else if (p.includes("deliveroo")) acc.deliveroo += net;
      else if (p.includes("own")) acc.own += net;
      else if (isThirdPartyPlatform(p)) acc.justEat += net; // any other aggregator → bucket here
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
    const aggregatorPct = pctOf(a.justEat + a.uber + a.deliveroo);
    return {
      store,
      justEatPct: pctOf(a.justEat),
      uberPct: pctOf(a.uber),
      deliverooPct: pctOf(a.deliveroo),
      ownDeliveryPct: pctOf(a.own),
      aggregatorPct,
      allDeliveryPct: pctOf(a.justEat + a.uber + a.deliveroo + a.own),
      overThreshold: aggregatorPct > T.platformDependencePct,
    };
  };

  const rows = [...byStore.entries()]
    .map(([store, a]) => toRow(store, a))
    .sort((x, y) => x.store.localeCompare(y.store));
  // Only add the combined TOTAL row when more than one store is in scope.
  if (!singleStore && rows.length > 1) rows.push(toRow("TOTAL", total));
  return rows;
}

// --- helpers ---------------------------------------------------------------

function topProductsForStore(products: ProductRow[], store: string, limit: number) {
  return products
    .filter((p) => p.store === store)
    .sort((a, b) => n(b.gross_sales) - n(a.gross_sales))
    .slice(0, limit)
    .map((p) => ({ name: p.item_name, revenue: n(p.gross_sales), units: n(p.units_sold) }));
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
    // Best seller = highest units sold (volume), not revenue.
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
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

function upsellOpportunity(mealDeals: MealDealRow[], kpi: KpiTableRow[]): Exception | null {
  // Meal-deal penetration = deal baskets ÷ orders, per store; report the store
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
  if (!grew) return null;
  return {
    text: `Meal deals are landing well at ${grew.store}: ${count(
      grew.baskets
    )} baskets sold, about ${pct(grew.penetration)} of all orders${
      grew.delta !== 0
        ? `, ${grew.delta > 0 ? "up" : "down"} ${count(Math.abs(grew.delta))} on last week`
        : ""
    } — a ready-made way to lift average spend.`,
  };
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
      revenueWow: n(p.revenue_wow_pct), // Why it's flagged (revenue decline)
      unitsWow: n(p.units_wow_pct), // What to display (units WoW is clearer)
      units: n(p.units_sold),
    }));
}
