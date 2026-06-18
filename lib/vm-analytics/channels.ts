// Shared delivery / in-store channel breakdown.
//
// Every dashboard that needs the delivery-vs-in-store split (AOV, net sales,
// delivery %) MUST derive it from here so the numbers are identical everywhere.
// Delivery = Own Delivery + the aggregator platforms (Deliveroo / Uber / Just
// Eat); everything else (Click & Collect, Kiosk, Till eat-in / takeaway, …) is
// in-store. The grouping is decided by isDeliveryChannel().

import { n } from "@/lib/vm-analytics/format";
import { isDeliveryChannel } from "@/lib/vm-analytics/constants";
import type { ExecRow, ExecChannelRow } from "@/lib/vm-analytics/types";

export const share = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

// Per-channel stats within a fulfilment group (delivery or in-store).
export interface ChannelStat {
  channel: string;
  netSales: number;
  orders: number;
  aov: number;
  orderPct: number; // share of orders within the group
  salesPct: number; // share of net sales within the group
}

export interface GroupAgg {
  netSales: number;
  orders: number;
  aov: number;
  channels: ChannelStat[];
}

// Aggregated view of a scope (one store, or several combined).
export interface Breakdown {
  netSales: number; // authoritative net sales (from exec rows)
  customers: number;
  orders: number; // delivery + in-store orders (channel-based)
  delivery: GroupAgg;
  inStore: GroupAgg;
  aov: number; // blended = net sales ÷ orders
  deliveryPct: number; // delivery net sales as % of net sales
  inStorePct: number; // in-store net sales as % of net sales
}

// Split a delivery GroupAgg into its two commercially-distinct parts:
//   • Own Delivery — the store's own drivers (keeps all the margin)
//   • Aggregator   — Deliveroo + Uber Eats + Just Eat blended (commission)
// AOV is always net sales ÷ orders, computed on the blended totals so it
// reconciles with the per-channel figures everywhere it is shown.
export interface SubGroup {
  netSales: number;
  orders: number;
  aov: number;
}

const isOwnDelivery = (ch: string) => /own|direct/i.test(ch);
const isAggregator = (ch: string) => /deliveroo|uber|just\s*eat/i.test(ch);

export function ownDelivery(group: GroupAgg): SubGroup {
  const cs = group.channels.filter((c) => isOwnDelivery(c.channel));
  const netSales = cs.reduce((s, c) => s + c.netSales, 0);
  const orders = cs.reduce((s, c) => s + c.orders, 0);
  return { netSales, orders, aov: orders > 0 ? netSales / orders : 0 };
}

export function aggregator(group: GroupAgg): SubGroup {
  const cs = group.channels.filter((c) => isAggregator(c.channel));
  const netSales = cs.reduce((s, c) => s + c.netSales, 0);
  const orders = cs.reduce((s, c) => s + c.orders, 0);
  return { netSales, orders, aov: orders > 0 ? netSales / orders : 0 };
}

export function groupAgg(rows: ExecChannelRow[], pred: (ch: string) => boolean): GroupAgg {
  const m = new Map<string, { net: number; orders: number }>();
  for (const r of rows) {
    if (!pred(r.channel)) continue;
    const c = m.get(r.channel) ?? { net: 0, orders: 0 };
    c.net += n(r.net_sales);
    c.orders += n(r.orders);
    m.set(r.channel, c);
  }
  let netSales = 0;
  let orders = 0;
  Array.from(m.values()).forEach((c) => {
    netSales += c.net;
    orders += c.orders;
  });
  const channels: ChannelStat[] = Array.from(m.entries())
    .map(([channel, c]) => ({
      channel,
      netSales: c.net,
      orders: c.orders,
      aov: c.orders > 0 ? c.net / c.orders : 0,
      orderPct: share(c.orders, orders),
      salesPct: share(c.net, netSales),
    }))
    .sort((a, b) => b.netSales - a.netSales);
  return { netSales, orders, aov: orders > 0 ? netSales / orders : 0, channels };
}

// Build a delivery / in-store breakdown for a scope (one or more stores).
// netSales/customers come from the authoritative exec rows; the delivery vs
// in-store split and per-group AOV come from the channel-level rows.
export function buildBreakdown(
  stores: readonly string[],
  execRows: ExecRow[],
  chanRows: ExecChannelRow[]
): Breakdown {
  const scopedExec = execRows.filter((r) => stores.includes(r.store));
  const scopedChan = chanRows.filter((r) => stores.includes(r.store));
  let netSales = 0;
  let customers = 0;
  for (const r of scopedExec) {
    netSales += n(r.net_sales);
    customers += n(r.customer_count);
  }
  const delivery = groupAgg(scopedChan, isDeliveryChannel);
  const inStore = groupAgg(scopedChan, (ch) => !isDeliveryChannel(ch));
  const orders = delivery.orders + inStore.orders;
  return {
    netSales,
    customers,
    orders,
    delivery,
    inStore,
    aov: orders > 0 ? netSales / orders : 0,
    deliveryPct: share(delivery.netSales, netSales),
    inStorePct: share(inStore.netSales, netSales),
  };
}
