// Canonical store names exactly as stored in Supabase (meta `store` column).
export const STORES = ["Peckers Hitchin", "Peckers Stevenage"] as const;
export type StoreName = (typeof STORES)[number];

// Short labels for table headers / chart legends.
export const STORE_LABEL: Record<string, string> = {
  "Peckers Hitchin": "Hitchin",
  "Peckers Stevenage": "Stevenage",
};

export function shortStore(store: string): string {
  return STORE_LABEL[store] ?? store.replace(/^Peckers\s+/i, "");
}

// The dashboards exposed under the "VM Analytics" module dropdown.
export type DashboardKey =
  | "executive"
  | "products"
  | "daypart"
  | "delivery"
  | "store-comparison";

export interface DashboardDef {
  key: DashboardKey;
  href: string;
  title: string;
  blurb: string;
}

export const DASHBOARDS: DashboardDef[] = [
  {
    key: "executive",
    href: "/vm-analytics/executive",
    title: "Executive Dashboard",
    blurb: "High-level overview of both stores",
  },
  {
    key: "products",
    href: "/vm-analytics/products",
    title: "Product Performance",
    blurb: "Best & worst performing menu items",
  },
  {
    key: "daypart",
    href: "/vm-analytics/daypart",
    title: "Daypart Analysis",
    blurb: "Trading patterns across the day",
  },
  {
    key: "delivery",
    href: "/vm-analytics/delivery",
    title: "Delivery Platform Performance",
    blurb: "Performance by ordering channel",
  },
  {
    key: "store-comparison",
    href: "/vm-analytics/store-comparison",
    title: "Store Comparison",
    blurb: "Hitchin vs Stevenage head-to-head",
  },
];
