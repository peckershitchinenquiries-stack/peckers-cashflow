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

// Per store × week × category aggregate from vm_v_category_performance, with
// SQL-computed WoW vs the same category exactly 7 days earlier. Unmapped items
// fall into an 'Uncategorised' category. Powers the Product Performance
// dashboard's Category Performance table.
export interface CategoryPerfRow {
  store: string;
  week_start: string;
  category: string;
  units_sold: Num;
  gross_sales: Num;
  revenue_wow_pct: Num | null;
  units_wow_pct: Num | null;
}

// A product-performance row tagged with its category, from vm_v_product_category.
// Used to drill down into a category's individual items.
export interface ProductCategoryRow extends ProductRow {
  category: string;
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

// Delivery vs in-store split for dayparts, from vm_v_daypart_channel
// (derived from line-item data). channel is "Delivery" | "In-store".
export interface DaypartChannelRow {
  store: string;
  week_start: string;
  daypart: string;
  daypart_rank: number;
  channel: string;
  orders: Num;
  net_sales: Num;
  aov: Num;
}

// Finer daypart × channel breakdown, from vm_v_daypart_channel_detail
// (line-item derived, opening-hours filtered). channel_group is
// "delivery" | "in_store"; channel_name is one of the executive channels
// (Own Delivery, Deliveroo, Uber Eats, Just Eat, Click & Collect, Kiosk,
// Till (eat-in), Till (takeaway)).
export interface DaypartChannelDetailRow {
  store: string;
  week_start: string;
  daypart: string;
  daypart_rank: number;
  channel_group: string;
  channel_name: string;
  orders: Num;
  net_sales: Num;
  aov: Num;
}

// Per (store, weekday, hour) trading activity from the raw
// vm_hourly_order_activity report. avg_daily_* are the average across the days
// that hour traded, so summing them per hour across weekdays reproduces the
// vm_v_daypart_summary orders/revenue exactly.
export interface HourlyActivityRow {
  store: string;
  week_start: string;
  weekday: string;
  weekday_id: Num;
  order_hour: Num;
  avg_daily_sales: Num;
  avg_daily_orders: Num;
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

// Menu-category × channel breakdown, from vm_v_menu_category_channel
// (line-item derived). channel_group is "delivery" | "in_store"; channel_name
// is one of the executive channels. Powers the "Meal Boxes & Platters" /
// "Platters" tables on the Daypart dashboard (AOV per channel).
export interface MenuCategoryChannelRow {
  store: string;
  week_start: string;
  menu_category: string;
  channel_group: string;
  channel_name: string;
  orders: Num;
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

// Executive dashboard view mode. "week" = a single completed week (default);
// "4w"/"12w" = the latest N completed weeks aggregated, compared to the same N
// weeks one year earlier.
export type ExecMode = "week" | "4w" | "12w";

// Row from the `weekly_summary_inputs` Supabase table.
// Numeric columns arrive as strings via PostgREST.
export interface WeeklySummaryInputRow {
  id?: number;
  store: string;
  week_start_iso: string;
  cogs?: number | string | null;
  cogs_hitchin?: number | string | null;
  fillings_and_samosas?: number | string | null;
  packaging_costs?: number | string | null;
  marketing?: number | string | null;
  labour_cost?: number | string | null;
  occupancy_cost?: number | string | null;
  aggregator_costs?: number | string | null;
  gross_margin_budget_pct?: number | string | null;
  labour_budget_pct?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Insight {
  source: "claude" | "rules";
  summary: string;
  bullets: string[];
}

// Historical weekly row from one of the vm_yoy_* tables.
// week_commencing is the Monday ISO date (YYYY-MM-DD) one year prior.
export interface YoyRow {
  week_commencing:    string;
  click_collect:      Num;
  kiosk:              Num;
  till_eat_in:        Num;
  till_takeaway:      Num;
  own_delivery:       Num;
  deliveroo:          Num;
  just_eat:           Num;
  uber_eats:          Num;
  total_sales:        Num;
  in_store_sales:     Num;
  delivery_sales:     Num;
  in_store_pct:       Num;
  delivery_pct:       Num;
  own_delivery_sales: Num;
  aggregate_sales:    Num;
  own_delivery_pct:   Num;
  aggregate_pct:      Num;
  // From EPOS channel exports
  total_orders:      Num;
  new_customers:     Num;
  return_customers:  Num;
  total_customers:   Num;
}
