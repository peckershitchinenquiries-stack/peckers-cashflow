import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { LiveDashboard } from "@/components/live/LiveDashboard";
import { ManagerQuickEntry } from "@/components/manager/ManagerQuickEntry";
import { todayISO } from "@/lib/utils";
import type {
  ClockEvent,
  DailyCashEntry,
  Employee,
  EmployeeScheduleDay,
  RotaShift,
  Store,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerLivePage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? null;
  const supabase = createServerSupabase();
  const today = todayISO();

  const [storesRes, employeesRes, shiftsRes, clocksRes, schedulesRes, cashRes] =
    await Promise.all([
      storeId
        ? supabase.from("stores").select("*").eq("id", storeId)
        : supabase.from("stores").select("*"),
      supabase
        .from("employees")
        .select("*")
        .eq("store_id", storeId ?? "")
        .neq("employment_status", "left"),
      supabase.from("rota_shifts").select("*").eq("shift_date", today).eq("store_id", storeId ?? ""),
      supabase.from("clock_events").select("*").eq("event_date", today).eq("store_id", storeId ?? ""),
      supabase.from("employee_schedules").select("*"),
      storeId
        ? supabase
            .from("daily_cash_entries")
            .select("*")
            .eq("store_id", storeId)
            .eq("entry_date", today)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const todayEntry = (cashRes.data ?? null) as DailyCashEntry | null;

  return (
    <>
      <PageHeader
        title="Live Dashboard"
        description="Real-time staffing for your store today. Refreshes every 30 seconds."
      />
      {storeId && (
        <div className="mb-6 max-w-md">
          <ManagerQuickEntry storeId={storeId} today={today} existing={todayEntry} />
        </div>
      )}
      <LiveDashboard
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
        shifts={(shiftsRes.data ?? []) as RotaShift[]}
        clocks={(clocksRes.data ?? []) as ClockEvent[]}
        schedules={(schedulesRes.data ?? []) as EmployeeScheduleDay[]}
        userRole="manager"
        userStoreId={storeId}
      />
    </>
  );
}
