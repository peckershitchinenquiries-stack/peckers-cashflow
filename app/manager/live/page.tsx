import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { LiveDashboard } from "@/components/live/LiveDashboard";
import { ManagerQuickEntry } from "@/components/manager/ManagerQuickEntry";
import { ManagerClockCard } from "@/components/manager/ManagerClockCard";
import { ClockReminderOptIn } from "@/components/crew/ClockReminderOptIn";
import {
  saveManagerPushSubscription,
  deleteManagerPushSubscription,
  sendManagerTestPush,
} from "@/app/actions/manager-push";
import { todayISO } from "@/lib/utils";
import type {
  ClockEvent,
  DailyCashEntry,
  Employee,
  EmployeeScheduleDay,
  ManagerClockEvent,
  RotaShift,
  Store,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerLivePage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? null;
  const supabase = createServerSupabase();
  const today = todayISO();

  // Staff aren't locked to one store, so the board must consider everyone
  // relevant to THIS store today: the store's own staff, plus anyone who clocked
  // in or was scheduled here (a visitor covering a shift). We resolve that set
  // first so we only pull those people's records — not every store's roster.
  const [
    storesRes,
    homeEmpIdsRes,
    clocksHereRes,
    shiftsHereRes,
    schedulesRes,
    cashRes,
    managerClockRes,
  ] = await Promise.all([
    storeId
      ? supabase.from("stores").select("*").eq("id", storeId)
      : supabase.from("stores").select("*"),
    supabase
      .from("employees")
      .select("id")
      .eq("store_id", storeId ?? "")
      .neq("employment_status", "left"),
    supabase.from("clock_events").select("employee_id").eq("event_date", today).eq("store_id", storeId ?? ""),
    supabase.from("rota_shifts").select("employee_id").eq("shift_date", today).eq("store_id", storeId ?? ""),
    supabase.from("employee_schedules").select("*"),
    storeId
      ? supabase
          .from("daily_cash_entries")
          .select("*")
          .eq("store_id", storeId)
          .eq("entry_date", today)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // The manager's own clock row for today (RLS returns only their own).
    supabase
      .from("manager_clock_events")
      .select("*")
      .eq("event_date", today)
      .maybeSingle(),
  ]);

  const relevantIds = Array.from(
    new Set<string>([
      ...(homeEmpIdsRes.data ?? []).map((r) => r.id as string),
      ...(clocksHereRes.data ?? []).map((r) => r.employee_id as string),
      ...(shiftsHereRes.data ?? []).map((r) => r.employee_id as string),
    ]),
  );

  // Full records for just those people — clocks/shifts across ALL stores (so a
  // home employee who clocked in elsewhere resolves away from this store rather
  // than showing as absent here).
  const [employeesRes, shiftsRes, clocksRes] = relevantIds.length
    ? await Promise.all([
        supabase
          .from("employees")
          .select("*")
          .in("id", relevantIds)
          .neq("employment_status", "left"),
        supabase.from("rota_shifts").select("*").eq("shift_date", today).in("employee_id", relevantIds),
        supabase.from("clock_events").select("*").eq("event_date", today).in("employee_id", relevantIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const todayEntry = (cashRes.data ?? null) as DailyCashEntry | null;
  const stores = (storesRes.data ?? []) as Store[];
  const myStore = stores.find((s) => s.id === storeId) ?? stores[0] ?? null;
  const managerClock = (managerClockRes.data ?? null) as ManagerClockEvent | null;

  return (
    <>
      <PageHeader
        title="Live Dashboard"
        description="Real-time staffing for your store today. Refreshes every 30 seconds."
      />
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ManagerClockCard
          managerName={user.allowed?.name ?? "Manager"}
          store={myStore}
          todayClock={managerClock}
        />
        {storeId && (
          <ManagerQuickEntry storeId={storeId} today={today} existing={todayEntry} />
        )}
      </div>
      <div className="mb-6">
        <ClockReminderOptIn
          saveSubscription={saveManagerPushSubscription}
          deleteSubscription={deleteManagerPushSubscription}
          sendTest={sendManagerTestPush}
        />
      </div>
      <LiveDashboard
        stores={stores}
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
