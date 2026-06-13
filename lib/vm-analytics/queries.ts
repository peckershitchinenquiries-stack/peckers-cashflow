import { getVMSupabaseServer } from "@/lib/vm-analytics/client";
import type {
  ExecRow,
  ProductRow,
  CategoryRow,
  DaypartRow,
  WeekdayRow,
  DeliveryRow,
  ComparisonRow,
  WeekOption,
} from "@/lib/vm-analytics/types";

// All KPI views are weekly. Most queries take an optional ISO week_start; when
// omitted they resolve to the latest available week.

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
