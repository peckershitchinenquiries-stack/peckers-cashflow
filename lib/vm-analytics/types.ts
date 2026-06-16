// Row shapes returned by the Supabase KPI views. Numeric columns arrive as
// strings via PostgREST, so every numeric field is typed `number | string`
// and normalised with format.n() at the point of use.

type Num = number | string | null;

export interface ExecRow {
  store: string;
  week_start: string;
  week_end: string;
  week_start_iso: string;
  week_end_iso: string;
  net_sales: Num;
  number_of_orders: Num;
  aov: Num;
  customer_count: Num;
  delivery_pct: Num;
  collection_pct: Num;
  eat_in_pct: Num;
  new_customer_count: Num;
  return_customer_count: Num;
  delivery_sales_amount: Num;
  collection_sales_amount: Num;
  eat_in_sales_amount: Num;
  net_sales_wow_pct: Num;
  orders_wow_pct: Num;
  customers_wow_pct: Num;
  aov_wow_pct: Num;
}

// Channel-level net sales + orders for a store/week, merged from
// vm_net_sales_by_channel and vm_orders_by_channel. Powers the Executive
// dashboard's per-channel AOV / order-mix breakdowns.
export interface ExecChannelRow {
  store: string;
  channel: string;
  net_sales: Num;
  orders: Num;
}

export interface ProductRow {
  store: string;
  week_start: string;
  item_name: string;
  units_sold: Num;
  gross_sales: Num;
  avg_item_price: Num;
  units_wow_pct: Num;
  revenue_wow_pct: Num;
}

export interface CategoryRow {
  store: string;
  week_start: string;
  external_category: string;
  gross_sales: Num;
  net_sales: Num;
  orders: Num;
  aov: Num;
  gross_sales_wow_pct: Num;
}

export interface DaypartRow {
  store: string;
  week_start: string;
  daypart: string;
  daypart_rank: number;
  orders: Num;
  revenue: Num;
  aov: Num;
}

export interface WeekdayRow {
  store: string;
  week_start: string;
  weekday_id: Num;
  weekday: string;
  orders: Num;
  revenue: Num;
  aov: Num;
}

export interface DeliveryRow {
  store: string;
  week_start: string;
  platform: string;
  bucket: string;
  orders: Num;
  gross_sales: Num;
  net_sales: Num;
  aov: Num;
  revenue_share_pct: Num;
  orders_share_pct: Num;
  gross_sales_wow_pct: Num;
}

export interface ComparisonRow {
  store: string;
  week_start: string;
  week_end: string;
  gross_sales: Num;
  net_sales: Num;
  total_orders: Num;
  aov: Num;
  new_customers: Num;
  repeat_customers: Num;
  total_customers: Num;
  new_customer_pct: Num;
  delivery_mix_pct: Num;
  gross_sales_wow_pct: Num;
}

export interface LaborCostRow {
  store: string;
  week_start_date: string;
  labour_cost: Num;
  revenue: Num;
  labour_pct: Num;
}

export interface AttachmentRow {
  store: string;
  week_start: string;
  item_name: string;
  orders_with_item: Num;
  units: Num;
  total_orders: Num;
  attach_pct: Num;
  prev_attach_pct: Num;
  attach_pct_delta: Num; // percentage-point change vs previous week
}

export interface MealDealRow {
  store: string;
  week_start: string;
  deal_baskets: Num;
  prev_deal_baskets: Num;
  deal_baskets_delta: Num;
}

// One row per (store, meal deal) for a week, from the raw vm_meal_deals_sold
// table (the "Meal Deals Sold (weekly)" report, pulled per store). Powers the
// Lunch Time Deals section of the Daypart dashboard.
export interface LunchDealItemRow {
  store: string;
  meal_deal_name: string;
  no_of_meal_deals: Num;
  net_sales: Num;
}

// Delivery vs in-store split for meal deals, from vm_v_lunch_deals_channel
// (derived from line-item data). channel is "delivery" | "in_store".
export interface LunchDealChannelRow {
  store: string;
  channel: string;
  deal_baskets: Num;
  net_sales: Num;
  aov: Num;
}

// Per-individual-channel meal-deal mix (Deliveroo, Own Delivery, Kiosk, …),
// from vm_v_lunch_deals_channel_detail. channel_group is "delivery" | "in_store".
export interface LunchDealChannelDetailRow {
  store: string;
  channel_group: string;
  channel_name: string;
  deal_baskets: Num;
  net_sales: Num;
  aov: Num;
}

// Real menu categories (from products-with-modifiers), with WoW. Used by the
// exception report — the external-category report is mostly blank for these
// stores.
export interface MenuCategoryRow {
  store: string;
  week_start: string;
  category: string;
  gross_sales: Num;
  gross_sales_wow_pct: Num;
}

export interface WeekOption {
  week_start: string;
  week_end: string;
  week_start_iso: string;
}

export interface Insight {
  source: "claude" | "rules";
  summary: string;
  bullets: string[];
}
