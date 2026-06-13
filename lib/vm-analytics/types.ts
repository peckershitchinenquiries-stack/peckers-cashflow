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
