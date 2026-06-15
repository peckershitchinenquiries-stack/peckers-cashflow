import { getVMSupabaseServer } from "@/lib/vm-analytics/client";
import { getCashflowSupabaseServer } from "@/lib/supabase-cashflow";
import type {
  ExecRow,
  ProductRow,
  CategoryRow,
  DaypartRow,
  WeekdayRow,
  DeliveryRow,
  ComparisonRow,
  LaborCostRow,
  AttachmentRow,
  MealDealRow,
  MenuCategoryRow,
  WeekOption,
} from "@/lib/vm-analytics/types";

// All KPI views are weekly. Most queries take an optional ISO week_start; when
// omitted they resolve to the latest available week.

// Add N days to a YYYY-MM-DD date, returning the same format (UTC-safe so it
// never shifts across a day boundary due to local timezone).
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday (UTC) of the week containing `now`, as YYYY-MM-DD. Weeks at or after
// this date are the *current* (in-progress) week and shouldn't be offered as a
// completed reporting week.
function currentWeekMondayIso(now = new Date()): string {
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const shift = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + shift),
  );
  return monday.toISOString().slice(0, 10);
}

export async function getWeeks(): Promise<WeekOption[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_available_weeks")
    .select("week_start, week_end, week_start_iso")
    .order("week_start", { ascending: false });
  if (error) throw new Error(`getWeeks: ${error.message}`);
  return (data ?? []) as WeekOption[];
}

export async function resolveWeek(weekIso?: string): Promise<string | null> {
  if (weekIso) return weekIso;
  const weeks = await getWeeks();
  return weeks[0]?.week_start_iso ?? null;
}

// Pick the week immediately before `weekIso`, if one exists.
export async function previousWeek(weekIso: string): Promise<string | null> {
  const weeks = await getWeeks();
  const idx = weeks.findIndex((w) => w.week_start_iso === weekIso);
  if (idx === -1) return null;
  return weeks[idx + 1]?.week_start_iso ?? null;
}

export async function getExec(weekIso: string): Promise<ExecRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_exec_dashboard_with_wow")
    .select("*")
    .eq("week_start", weekIso);
  if (error) throw new Error(`getExec: ${error.message}`);
  return (data ?? []) as ExecRow[];
}

export async function getProducts(weekIso: string): Promise<ProductRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_product_performance")
    .select("*")
    .eq("week_start", weekIso)
    .order("gross_sales", { ascending: false });
  if (error) throw new Error(`getProducts: ${error.message}`);
  return (data ?? []) as ProductRow[];
}

export async function getCategories(weekIso: string): Promise<CategoryRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_category_performance")
    .select("*")
    .eq("week_start", weekIso)
    .order("gross_sales", { ascending: false });
  if (error) throw new Error(`getCategories: ${error.message}`);
  return (data ?? []) as CategoryRow[];
}

export async function getDayparts(weekIso: string): Promise<DaypartRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_daypart_summary")
    .select("*")
    .eq("week_start", weekIso)
    .order("daypart_rank", { ascending: true });
  if (error) throw new Error(`getDayparts: ${error.message}`);
  return (data ?? []) as DaypartRow[];
}

export async function getWeekdays(weekIso: string): Promise<WeekdayRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_daypart_weekday")
    .select("*")
    .eq("week_start", weekIso)
    .order("weekday_id", { ascending: true });
  if (error) throw new Error(`getWeekdays: ${error.message}`);
  return (data ?? []) as WeekdayRow[];
}

export async function getDelivery(weekIso: string): Promise<DeliveryRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_delivery_mix")
    .select("*")
    .eq("week_start", weekIso)
    .order("gross_sales", { ascending: false });
  if (error) throw new Error(`getDelivery: ${error.message}`);
  return (data ?? []) as DeliveryRow[];
}

export async function getComparison(weekIso: string): Promise<ComparisonRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_store_comparison")
    .select("*")
    .eq("week_start", weekIso);
  if (error) throw new Error(`getComparison: ${error.message}`);
  return (data ?? []) as ComparisonRow[];
}

// Per-item attachment rates (share of orders containing the item) with WoW
// delta. Used by the Weekly Exception Report for falling-attachment risks and
// upselling opportunities. Ordered most-attached first.
export async function getAttachmentRates(weekIso: string): Promise<AttachmentRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_attachment_with_wow")
    .select("*")
    .eq("week_start", weekIso)
    .order("attach_pct", { ascending: false });
  if (error) throw new Error(`getAttachmentRates: ${error.message}`);
  return (data ?? []) as AttachmentRow[];
}

// Meal-deal basket penetration per store with WoW. Supports upselling signals.
export async function getMealDeals(weekIso: string): Promise<MealDealRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_meal_deals")
    .select("*")
    .eq("week_start", weekIso);
  if (error) throw new Error(`getMealDeals: ${error.message}`);
  return (data ?? []) as MealDealRow[];
}

// Real menu categories with WoW (from products-with-modifiers source). The
// exception report uses this for "fastest-growing category" since the external-
// category report is largely blank for these stores.
export async function getMenuCategories(weekIso: string): Promise<MenuCategoryRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("vm_v_menu_category_wow")
    .select("*")
    .eq("week_start", weekIso)
    .order("gross_sales", { ascending: false });
  if (error) throw new Error(`getMenuCategories: ${error.message}`);
  return (data ?? []) as MenuCategoryRow[];
}

// Get available weeks for Labor Cost dashboard (from cashflow Supabase).
// week_start_date is the only week field these tables carry, so it serves as
// both the start and the (display) end of the option.
export async function getLaborCostWeeks(): Promise<WeekOption[]> {
  const sb = getCashflowSupabaseServer();
  const { data, error } = await sb
    .from("labor_cost_performance")
    .select("week_start_date")
    .order("week_start_date", { ascending: false });

  if (error) throw new Error(`getLaborCostWeeks: ${error.message}`);

  // Deduplicate (the view has one row per store/week) and drop nulls.
  // week_start_date is the Monday; the week runs Mon–Sun, so week_end is +6 days.
  // Exclude the current in-progress week — its data isn't fully synced yet, so
  // we only offer completed weeks (most recent completed week shows by default).
  const thisMonday = currentWeekMondayIso();
  const seen = new Set<string>();
  const weeks: WeekOption[] = [];
  for (const row of data ?? []) {
    const weekDate = (row as { week_start_date: string | null }).week_start_date;
    if (weekDate && weekDate < thisMonday && !seen.has(weekDate)) {
      seen.add(weekDate);
      weeks.push({
        week_start: weekDate,
        week_end: addDaysIso(weekDate, 6),
        week_start_iso: weekDate,
      });
    }
  }
  return weeks;
}

// Labor Cost Performance (from cashflow Supabase)
export async function getLaborCost(weekIso: string): Promise<LaborCostRow[]> {
  const sb = getCashflowSupabaseServer();
  const { data, error } = await sb
    .from("labor_cost_performance")
    .select("*")
    .eq("week_start_date", weekIso)
    .order("store", { ascending: true });

  if (error) throw new Error(`getLaborCost: ${error.message}`);

  // Cast rows and compute TOTAL row (sum across stores)
  const rows = (data ?? []) as LaborCostRow[];
  if (rows.length > 0) {
    const total: LaborCostRow = {
      store: "TOTAL",
      week_start_date: weekIso,
      labour_cost: rows.reduce((sum, r) => sum + (parseFloat(String(r.labour_cost)) || 0), 0),
      revenue: rows.reduce((sum, r) => sum + (parseFloat(String(r.revenue)) || 0), 0),
      labour_pct: 0,
    };
    // Recalculate labour_pct for the total
    const rev = Number(total.revenue ?? 0);
    const cost = Number(total.labour_cost ?? 0);
    total.labour_pct = rev > 0 ? Math.round((cost / rev) * 1000) / 10 : 0;
    return [...rows, total];
  }
  return rows;
}
