import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveActiveStoreId } from "@/lib/types";
import {
  RotaView,
  type RotaClockSession,
  type RotaManagerSession,
} from "@/components/rota/RotaView";
import { getAppSettings } from "@/app/actions/settings";
import {
  addDays,
  parseISODate,
  resolveRotaRange,
  startOfISOWeek,
  toISODate,
  todayISO,
} from "@/lib/utils";
import type {
  AllowedUser,
  ManagerClockEvent,
  ManagerShift,
  CoverDriver,
  CoverDriverClockEvent,
  CoverDriverScheduleDay,
  CoverDriverShift,
  RotaEmployee,
  EmployeeScheduleDay,
  RotaHistoryShift,
  RotaShift,
  Store,
  ClockEvent,
  WeeklyDelivery,
} from "@/lib/types";
import {
  COVER_SCHEDULE_COLUMNS,
  ROTA_CLOCK_COLUMNS,
  ROTA_CLOCK_SESSION_COLUMNS,
  ROTA_EMPLOYEE_COLUMNS,
  ROTA_HISTORY_SHIFT_COLUMNS,
  ROTA_MANAGER_SESSION_COLUMNS,
  ROTA_SHIFT_COLUMNS,
  SCHEDULE_COLUMNS,
} from "@/lib/rota-columns";

export const dynamic = "force-dynamic";

export default async function ManagerRotaPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  const user = await requireRole(["manager"]);
  const storeId = resolveActiveStoreId(user.allowed) ?? "";
  const supabase = createServerSupabase();
  const settings = await getAppSettings();

  const { startIso, endIso } = resolveRotaRange(searchParams.start, searchParams.end);
  // Weekly deliveries stay anchored to the ISO week containing the range start.
  const weekStartIso = toISODate(startOfISOWeek(parseISODate(startIso)));
  // Fetch 4 prior weeks (from the range start) so the rolling avg has history.
  const fourWeeksBack = toISODate(addDays(parseISODate(weekStartIso), -28));
  const dayBeforeRange = toISODate(addDays(parseISODate(startIso), -1));
  // No clock cell exists outside the visible range, and none can exist after
  // today — anything else the query returns is thrown away client-side.
  const clockEndIso = endIso < todayISO() ? endIso : todayISO();

  // Staff aren't locked to one store: a manager can schedule anyone onto their
  // store's rota, and needs to see when their own staff are working elsewhere.
  // So we load ALL active staff and ALL shifts/clocks in range (RotaView scopes
  // display to the active store). Only the non-sensitive employee columns are
  // fetched — the rota never needs bank details, so other stores' payment info
  // is not pulled into the page.
  const [
    storesRes,
    employeesRes,
    shiftsRes,
    shiftHistoryRes,
    clocksRes,
    clockSessionsRes,
    deliveriesRes,
    schedulesRes,
    managersRes,
    managerShiftsRes,
    managerClocksRes,
    managerSessionsRes,
    coverDriversRes,
    coverShiftsRes,
    coverSchedulesRes,
    coverClocksRes,
  ] = await Promise.all([
      supabase.from("stores").select("*").order("name"),
      supabase
        .from("employees")
        .select(ROTA_EMPLOYEE_COLUMNS)
        .neq("employment_status", "left")
        .order("name"),
      supabase
        .from("rota_shifts")
        .select(ROTA_SHIFT_COLUMNS)
        .gte("shift_date", startIso)
        .lte("shift_date", endIso)
        .order("shift_date"),
      supabase
        .from("rota_shifts")
        .select(ROTA_HISTORY_SHIFT_COLUMNS)
        .gte("shift_date", fourWeeksBack)
        .lte("shift_date", dayBeforeRange)
        .order("shift_date"),
      supabase
        .from("clock_events")
        .select(ROTA_CLOCK_COLUMNS)
        .gte("event_date", startIso)
        .lte("event_date", clockEndIso),
      supabase
        .from("clock_sessions")
        .select(ROTA_CLOCK_SESSION_COLUMNS)
        .gte("event_date", startIso)
        .lte("event_date", clockEndIso),
      supabase
        .from("weekly_deliveries")
        .select("*")
        .eq("store_id", storeId)
        .eq("week_start_date", weekStartIso),
      supabase.from("employee_schedules").select(SCHEDULE_COLUMNS),
      // Managers cross-cover, so every manager is loaded — identity columns
      // only, never wages, contact details or login fields.
      supabase
        .from("allowed_users")
        .select("id, name, username, role, store_id")
        .eq("role", "manager"),
      supabase
        .from("manager_shifts")
        .select("*")
        .gte("shift_date", startIso)
        .lte("shift_date", endIso),
      // RLS scopes these to this store's days (034/061); a peer's attendance
      // elsewhere stays private between them and the admin.
      supabase
        .from("manager_clock_events")
        .select(
          "manager_id, event_date, store_id, clock_in_at, clock_out_at, auto_clocked_out, session_count, worked_hours",
        )
        .gte("event_date", startIso)
        .lte("event_date", clockEndIso),
      supabase
        .from("manager_clock_sessions")
        .select(ROTA_MANAGER_SESSION_COLUMNS)
        .gte("event_date", startIso)
        .lte("event_date", clockEndIso),
      // Cover drivers belong to one store and aren't loaned out, so unlike
      // staff these are scoped to this store rather than loaded estate-wide.
      supabase
        .from("cover_drivers")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true),
      supabase
        .from("cover_driver_shifts")
        .select("*")
        .eq("store_id", storeId)
        .gte("shift_date", startIso)
        .lte("shift_date", endIso),
      supabase.from("cover_driver_schedules").select(COVER_SCHEDULE_COLUMNS),
      supabase
        .from("cover_driver_clock_events")
        .select("*")
        .eq("store_id", storeId)
        .gte("event_date", startIso)
        .lte("event_date", clockEndIso),
    ]);

  return (
    <>
      <PageHeader
        title="Rota Management"
        description="Weekly scheduling for your store. NI = first 20h, cash = remainder."
      />
      <RotaView
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as RotaEmployee[]}
        shifts={(shiftsRes.data ?? []) as RotaShift[]}
        historyShifts={(shiftHistoryRes.data ?? []) as RotaHistoryShift[]}
        clocks={(clocksRes.data ?? []) as ClockEvent[]}
        clockSessions={(clockSessionsRes.data ?? []) as RotaClockSession[]}
        weeklyDeliveries={(deliveriesRes.data ?? []) as WeeklyDelivery[]}
        schedules={(schedulesRes.data ?? []) as EmployeeScheduleDay[]}
        managers={(managersRes.data ?? []) as AllowedUser[]}
        managerShifts={(managerShiftsRes.data ?? []) as ManagerShift[]}
        managerClocks={(managerClocksRes.data ?? []) as ManagerClockEvent[]}
        managerSessions={(managerSessionsRes.data ?? []) as RotaManagerSession[]}
        coverDrivers={(coverDriversRes.data ?? []) as CoverDriver[]}
        coverDriverShifts={(coverShiftsRes.data ?? []) as CoverDriverShift[]}
        coverDriverSchedules={(coverSchedulesRes.data ?? []) as CoverDriverScheduleDay[]}
        coverDriverClocks={(coverClocksRes.data ?? []) as CoverDriverClockEvent[]}
        minWageBands={settings.min_wage_bands}
        shiftTimes={settings.shift_times}
        rangeStartIso={startIso}
        rangeEndIso={endIso}
        userRole="manager"
        userStoreId={storeId || null}
      />
    </>
  );
}
