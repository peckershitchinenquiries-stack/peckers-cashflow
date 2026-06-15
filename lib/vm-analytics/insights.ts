// Deterministic, zero-dependency commentary generator. Produces management-
// style summaries from the KPI facts each dashboard extracts. This is the
// default ("Auto") commentary AND the structured guide handed to Claude when an
// ANTHROPIC_API_KEY is present (see app/api/insights/route.ts).

import type { Insight } from "@/lib/vm-analytics/types";
import { shortStore } from "@/lib/vm-analytics/constants";

const gbp = (v: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(v || 0);

const pct = (v: number | null) =>
  v === null || v === undefined ? "n/a" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export interface ExecInput {
  dashboard: "executive";
  week: string;
  stores: {
    store: string;
    netSales: number;
    orders: number;
    aov: number;
    customers: number;
    deliveryPct: number;
    collectionPct: number;
    eatInPct: number;
    netSalesWow: number | null;
  }[];
  totalWow: number | null;
}

export interface ProductInput {
  dashboard: "products";
  week: string;
  top: { item: string; units: number; revenue: number; revWow: number | null }[];
  rising: { item: string; revWow: number }[];
  falling: { item: string; revWow: number }[];
}

export interface DaypartInput {
  dashboard: "daypart";
  week: string;
  periods: { daypart: string; orders: number; revenue: number; aov: number }[];
}

export interface DeliveryInput {
  dashboard: "delivery";
  week: string;
  channels: {
    platform: string;
    revenue: number;
    orders: number;
    aov: number;
    sharePct: number;
    wow: number | null;
  }[];
}

export interface ComparisonInput {
  dashboard: "store-comparison";
  week: string;
  stores: {
    store: string;
    revenue: number;
    orders: number;
    aov: number;
    customers: number;
  }[];
}

export type InsightInput =
  | ExecInput
  | ProductInput
  | DaypartInput
  | DeliveryInput
  | ComparisonInput;

// ---------------------------------------------------------------------------

function execInsight(i: ExecInput): { summary: string; bullets: string[] } {
  const bullets: string[] = [];
  const total = i.stores.reduce((s, x) => s + x.netSales, 0);
  const totalOrders = i.stores.reduce((s, x) => s + x.orders, 0);

  const lead =
    i.totalWow === null
      ? `Combined net sales were ${gbp(total)} across ${totalOrders.toLocaleString()} orders.`
      : `Combined net sales ${i.totalWow >= 0 ? "increased" : "fell"} ${pct(
          i.totalWow
        )} week-on-week to ${gbp(total)} across ${totalOrders.toLocaleString()} orders.`;

  const ranked = [...i.stores].sort((a, b) => b.netSales - a.netSales);
  let summary = lead;
  if (ranked.length >= 2) {
    const [win, lose] = ranked;
    summary += ` ${shortStore(win.store)} led on revenue (${gbp(
      win.netSales
    )}) ahead of ${shortStore(lose.store)} (${gbp(lose.netSales)}).`;
  }

  for (const s of i.stores) {
    bullets.push(
      `${shortStore(s.store)}: ${gbp(s.netSales)} net sales, ${s.orders.toLocaleString()} orders, ${gbp(
        s.aov
      )} AOV${s.netSalesWow !== null ? ` (${pct(s.netSalesWow)} WoW)` : ""}.`
    );
  }

  // Channel mix call-out from the strongest store.
  const lead2 = ranked[0];
  if (lead2) {
    bullets.push(
      `${shortStore(lead2.store)} channel mix — delivery ${lead2.deliveryPct.toFixed(
        0
      )}%, collection ${lead2.collectionPct.toFixed(0)}%, eat-in ${lead2.eatInPct.toFixed(
        0
      )}%.`
    );
  }
  return { summary, bullets };
}

function productInsight(i: ProductInput): { summary: string; bullets: string[] } {
  const bullets: string[] = [];
  const best = i.top[0];
  let summary = best
    ? `${best.item} was the top seller with ${best.units.toLocaleString()} units and ${gbp(
        best.revenue
      )} revenue.`
    : "No product sales recorded for this week.";

  if (i.top.length > 1) {
    summary += ` The top ${Math.min(5, i.top.length)} items are led by ${i.top
      .slice(0, 3)
      .map((t) => t.item)
      .join(", ")}.`;
  }

  if (i.rising.length) {
    bullets.push(
      `Fastest growing: ${i.rising
        .slice(0, 3)
        .map((r) => `${r.item} (${pct(r.revWow)})`)
        .join(", ")}.`
    );
  }
  if (i.falling.length) {
    bullets.push(
      `Declining: ${i.falling
        .slice(0, 3)
        .map((r) => `${r.item} (${pct(r.revWow)})`)
        .join(", ")} — review placement or promotion.`
    );
  }
  if (!i.rising.length && !i.falling.length) {
    bullets.push("Week-on-week trends will appear once a second week is synced.");
  }
  return { summary, bullets };
}

function daypartInsight(i: DaypartInput): { summary: string; bullets: string[] } {
  const bullets: string[] = [];
  const ranked = [...i.periods].sort((a, b) => b.revenue - a.revenue);
  const peak = ranked[0];
  const quiet = ranked[ranked.length - 1];

  let summary = peak
    ? `${peak.daypart} is the peak trading period (${gbp(peak.revenue)} on ${Math.round(
        peak.orders
      )} orders).`
    : "No daypart activity recorded for this week.";
  if (quiet && quiet !== peak) {
    summary += ` ${quiet.daypart} is the quietest — a candidate for targeted promotions.`;
  }

  const highestAov = [...i.periods].sort((a, b) => b.aov - a.aov)[0];
  if (highestAov) {
    bullets.push(
      `Highest AOV in ${highestAov.daypart} at ${gbp(highestAov.aov)} per order.`
    );
  }
  for (const p of ranked.slice(0, 4)) {
    bullets.push(
      `${p.daypart}: ${Math.round(p.orders)} orders, ${gbp(p.revenue)}, ${gbp(
        p.aov
      )} AOV.`
    );
  }
  return { summary, bullets };
}

function deliveryInsight(i: DeliveryInput): { summary: string; bullets: string[] } {
  const bullets: string[] = [];
  const ranked = [...i.channels].sort((a, b) => b.revenue - a.revenue);
  const top = ranked[0];
  let summary = top
    ? `${top.platform} is the largest channel at ${gbp(top.revenue)} (${top.sharePct.toFixed(
        0
      )}% of revenue).`
    : "No channel activity recorded for this week.";

  const bestAov = [...i.channels].sort((a, b) => b.aov - a.aov)[0];
  if (bestAov) {
    summary += ` ${bestAov.platform} carries the highest AOV at ${gbp(bestAov.aov)}.`;
  }

  for (const c of ranked.slice(0, 5)) {
    bullets.push(
      `${c.platform}: ${gbp(c.revenue)} (${c.sharePct.toFixed(0)}%), ${Math.round(
        c.orders
      )} orders, ${gbp(c.aov)} AOV${c.wow !== null ? ` (${pct(c.wow)} WoW)` : ""}.`
    );
  }

  const direct = i.channels.find(
    (c) => /own|direct|in-store|collection/i.test(c.platform)
  );
  if (direct) {
    bullets.push(
      `Direct / first-party channels at ${direct.sharePct.toFixed(
        0
      )}% — growing these reduces marketplace commission.`
    );
  }
  return { summary, bullets };
}

function comparisonInsight(i: ComparisonInput): {
  summary: string;
  bullets: string[];
} {
  const bullets: string[] = [];
  if (i.stores.length < 2) {
    return {
      summary: "Two stores are required for a comparison.",
      bullets: i.stores.map(
        (s) =>
          `${shortStore(s.store)}: ${gbp(s.revenue)} revenue, ${s.orders.toLocaleString()} orders.`
      ),
    };
  }
  const [a, b] = i.stores;
  const revLead = a.revenue >= b.revenue ? a : b;
  const revLag = revLead === a ? b : a;
  const revGap =
    revLag.revenue > 0
      ? ((revLead.revenue - revLag.revenue) / revLag.revenue) * 100
      : 0;

  const aovLead = a.aov >= b.aov ? a : b;
  const aovLag = aovLead === a ? b : a;
  const aovGap =
    aovLag.aov > 0 ? ((aovLead.aov - aovLag.aov) / aovLag.aov) * 100 : 0;

  const summary = `${shortStore(revLead.store)} generated ${revGap.toFixed(
    0
  )}% more revenue than ${shortStore(revLag.store)} this week (${gbp(
    revLead.revenue
  )} vs ${gbp(revLag.revenue)}).`;

  bullets.push(
    `${shortStore(aovLead.store)} had a ${aovGap.toFixed(
      0
    )}% higher average order value (${gbp(aovLead.aov)} vs ${gbp(aovLag.aov)}).`
  );
  const ordLead = a.orders >= b.orders ? a : b;
  const ordLag = ordLead === a ? b : a;
  const ordGap =
    ordLag.orders > 0
      ? ((ordLead.orders - ordLag.orders) / ordLag.orders) * 100
      : 0;
  bullets.push(
    `${shortStore(ordLead.store)} processed ${ordGap.toFixed(
      0
    )}% more orders (${ordLead.orders.toLocaleString()} vs ${ordLag.orders.toLocaleString()}).`
  );
  bullets.push(
    "Labour cost / labour % is not yet captured in Vita Mojo — add it as a manual input to complete this view."
  );
  return { summary, bullets };
}

export function buildInsights(input: InsightInput): Insight {
  let res: { summary: string; bullets: string[] };
  switch (input.dashboard) {
    case "executive":
      res = execInsight(input);
      break;
    case "products":
      res = productInsight(input);
      break;
    case "daypart":
      res = daypartInsight(input);
      break;
    case "delivery":
      res = deliveryInsight(input);
      break;
    case "store-comparison":
      res = comparisonInsight(input);
      break;
  }
  return { source: "rules", ...res };
}

// Prompt fed to Claude: the raw facts + the rule-based draft as a style guide.
export function buildClaudePrompt(input: InsightInput): string {
  const draft = buildInsights(input);
  return [
    "You are a hospitality operations analyst writing a concise weekly management summary",
    "for Peckers, a two-site fried-chicken business (Hitchin and Stevenage).",
    "",
    `Dashboard: ${input.dashboard}. Week starting: ${input.week}.`,
    "",
    "Structured KPI facts (JSON):",
    JSON.stringify(input, null, 2),
    "",
    "A deterministic draft of the commentary (use it for tone and to anchor the numbers,",
    "but improve the prose and surface the most decision-useful insight):",
    JSON.stringify(draft, null, 2),
    "",
    "Write the response as JSON only, matching exactly:",
    '{ "summary": string (2-3 sentences), "bullets": string[] (3-5 short, action-oriented points) }',
    "Rules: use GBP (£), be specific with the numbers provided, do not invent figures,",
    "and keep it punchy and operational. Return ONLY the JSON object.",
  ].join("\n");
}
