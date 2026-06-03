import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { RotaView } from "@/components/rota/RotaView";
import { getAppSettings } from "@/app/actions/settings";
import { addDays, startOfISOWeek, toISODate, todayISO } from "@/lib/utils";
import type {
  Employee,
  EmployeeScheduleDay,
  RotaShift,
  Store,
  ClockEvent,
  WeeklyDelivery,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerRotaPage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? "";
  const supabase = createServerSupabase();
  const settings = await getAppSettings();

  const weekStart = startOfISOWeek(new Date());
  const weekStartIso = toISODate(weekStart);
  const weekEndIso = toISODate(addDays(weekStart, 6));
  const fourWeeksBack = toISODate(addDays(weekStart, -28));

  const [storesRes, employeesRes, shiftsRes, clocksRes, deliveriesRes, schedulesRes] =
    await Promise.all([
      supabase.from("stores").select("*").eq("id", storeId),
      supabase
        .from("employees")
        .select("*")
        .eq("store_id", storeId)
        .neq("employment_status", "left")
        .order("name"),
      supabase
        .from("rota_shifts")
        .select("*")
        .eq("store_id", storeId)
        .gte("shift_date", fourWeeksBack)
        .lte("shift_date", weekEndIso),
      supabase
        .from("clock_events")
        .select("*")
        .eq("store_id", storeId)
        .gte("event_date", fourWeeksBack)
        .lte("event_date", todayISO()),
      supabase
        .from("weekly_deliveries")
        .select("*")
        .eq("store_id", storeId)
        .eq("week_start_date", weekStartIso),
      supabase.from("employee_schedules").select("*"),
    ]);

  return (
    <>
      <PageHeader
        title="Rota Management"
        description="Weekly scheduling for your store. NI = first 20h, cash = remainder."
      />
      <RotaView
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
        shifts={(shiftsRes.data ?? []) as RotaShift[]}
        clocks={(clocksRes.data ?? []) as ClockEvent[]}
        weeklyDeliveries={(deliveriesRes.data ?? []) as WeeklyDelivery[]}
        schedules={(schedulesRes.data ?? []) as EmployeeScheduleDay[]}
        minWageBands={settings.min_wage_bands}
        weekStartIso={weekStartIso}
        userRole="manager"
        userStoreId={storeId || null}
      />
    </>
  );
}
