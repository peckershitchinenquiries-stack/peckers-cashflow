import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { RotaView } from "@/components/rota/RotaView";
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
  Employee,
  EmployeeScheduleDay,
  RotaShift,
  Store,
  ClockEvent,
  WeeklyDelivery,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RotaPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  const user = await requireUser();
  const supabase = createServerSupabase();
  const settings = await getAppSettings();

  // Visible range — defaults to the current ISO week, fully customizable via
  // ?start=&end= query params set by the calendar picker.
  const { startIso, endIso } = resolveRotaRange(searchParams.start, searchParams.end);
  // Weekly deliveries stay anchored to the ISO week containing the range start.
  const weekStartIso = toISODate(startOfISOWeek(parseISODate(startIso)));

  // For 4-week rolling avg we also fetch the prior 4 weeks of shifts
  const fourWeeksBack = toISODate(addDays(parseISODate(weekStartIso), -28));

  const [storesRes, employeesRes, shiftsRes, clocksRes, deliveriesRes, schedulesRes] =
    await Promise.all([
      supabase.from("stores").select("*").order("name"),
      supabase
        .from("employees")
        .select("*")
        .neq("employment_status", "left")
        .order("name"),
      supabase
        .from("rota_shifts")
        .select("*")
        .gte("shift_date", fourWeeksBack)
        .lte("shift_date", endIso),
      supabase
        .from("clock_events")
        .select("*")
        .gte("event_date", fourWeeksBack)
        .lte("event_date", todayISO()),
      supabase
        .from("weekly_deliveries")
        .select("*")
        .eq("week_start_date", weekStartIso),
      supabase.from("employee_schedules").select("*"),
    ]);

  return (
    <>
      <PageHeader
        title="Rota Management"
        description="Weekly staff scheduling. Hours and wages are auto-calculated. NI = first 20h, cash = remainder."
      />
      <RotaView
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
        shifts={(shiftsRes.data ?? []) as RotaShift[]}
        clocks={(clocksRes.data ?? []) as ClockEvent[]}
        weeklyDeliveries={(deliveriesRes.data ?? []) as WeeklyDelivery[]}
        schedules={(schedulesRes.data ?? []) as EmployeeScheduleDay[]}
        minWageBands={settings.min_wage_bands}
        rangeStartIso={startIso}
        rangeEndIso={endIso}
        userRole={user.allowed?.role ?? "manager"}
        userStoreId={user.allowed?.store_id ?? null}
      />
    </>
  );
}
