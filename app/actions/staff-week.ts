"use server";

import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { resolveActiveStoreId } from "@/lib/types";
import type { CashPayoutStatus, Employee } from "@/lib/types";
import { resolveWeek, type CoverDriverPayRow } from "@/lib/cash-flow";
import { addDays, londonISODate, parseISODate, startOfISOWeek, toISODate } from "@/lib/utils";
import {
  buildStaffWeek,
  type StaffWeekBookingRow,
  type StaffWeekClockRow,
  type StaffWeekCoverClock,
  type StaffWeekCoverDriver,
  type StaffWeekFrozenLine,
  type StaffWeekManager,
  type StaffWeekManagerDay,
  type StaffWeekManagerSession,
  type StaffWeekPerson,
  type StaffWeekSessionRow,
} from "@/lib/staff-week";

export type StaffWeekPayout = {
  storeId: string;
  status: CashPayoutStatus;
  confirmedAt: string | null;
  confirmedByName: string | null;
};

export type StaffWeek = {
  weekStart: string;
  weekEnd: string;
  /** The payout sheet that settles this work week (week_start_date = +7 days). */
  payoutWeekStart: string;
  /** Its Tuesday. */
  paymentDate: string;
  /** Monday of the current London week — the newest week that can be opened. */
  thisWeekStart: string;
  stores: { id: string; name: string }[];
  payouts: StaffWeekPayout[];
  people: StaffWeekPerson[];
  /** Surfaced, never swallowed: an empty week from a broken query reads as "nobody worked". */
  loadError: string | null;
};

const EARLIEST_WEEKS_BACK = 104;

/**
 * Read-only weekly summary for the Employees → Weekly Summary tab.
 *
 * Reads exactly what the Tuesday payout reads for the same work week, and
 * prices it with the payout's own builders (see lib/staff-week.ts). Writes
 * nothing, so it cannot move any figure anywhere else in the app.
 */
export async function loadStaffWeek(weekParam: string): Promise<StaffWeek> {
  const user = await getSessionUser();
  if (!user?.allowed) throw new Error("Not authorised");
  const role = user.allowed.role;
  if (role !== "admin" && role !== "manager") {
    throw new Error("The weekly summary is restricted to managers and admins.");
  }
  // Re-derived here rather than trusted from the page: a server action is a
  // public endpoint.
  const scopeStoreId = role === "manager" ? resolveActiveStoreId(user.allowed) : null;
  if (role === "manager" && !scopeStoreId) throw new Error("No store assigned to your account.");

  const thisWeekStart = toISODate(startOfISOWeek(parseISODate(londonISODate(new Date()))));
  const earliest = toISODate(addDays(parseISODate(thisWeekStart), -7 * EARLIEST_WEEKS_BACK));
  let { weekStart } = resolveWeek(weekParam);
  if (weekStart > thisWeekStart) weekStart = thisWeekStart;
  if (weekStart < earliest) weekStart = earliest;
  const start = parseISODate(weekStart);
  const weekEnd = toISODate(addDays(start, 6));
  const payoutWeekStart = toISODate(addDays(start, 7));
  const paymentDate = toISODate(addDays(start, 8));

  const supabase = createServerSupabase();
  const [
    employeesRes,
    storesRes,
    clocksRes,
    sessionsRes,
    managersRes,
    managerDaysRes,
    managerSessionsRes,
    payoutsRes,
    coverDriversRes,
    coverClocksRes,
    coverApprovedRes,
    rotaRes,
    managerRotaRes,
    coverRotaRes,
  ] = await Promise.all([
    // Leavers included: pay is a week in arrears. `*` because the payout's
    // builder takes whole Employee rows; nothing beyond rates leaves the server.
    supabase.from("employees").select("*"),
    supabase.from("stores").select("id, name").order("name"),
    // Every store: the NI/cash split needs the employee's WHOLE week.
    supabase
      .from("clock_events")
      .select(
        "id, employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, hours_approved, approved_hours, manual_entry, auto_clocked_out, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
      )
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    supabase
      .from("clock_sessions")
      .select(
        "clock_event_id, store_id, clock_in_at, clock_out_at, manual_entry, auto_clocked_out, hours_approved, approved_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries",
      )
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    supabase
      .from("allowed_users")
      .select(
        "id, name, store_id, fixed_daily_wage, short_delivery_rate, long_delivery_rate, extra_short_delivery_rate, extra_long_delivery_rate",
      )
      .eq("role", "manager"),
    supabase
      .from("manager_clock_events")
      .select(
        "id, manager_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, manual_entry, auto_clocked_out, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, approved_short_deliveries_count, approved_long_deliveries_count, approved_extra_short_deliveries, approved_extra_long_deliveries",
      )
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    supabase
      .from("manager_clock_sessions")
      .select(
        "clock_event_id, store_id, clock_in_at, clock_out_at, manual_entry, auto_clocked_out, deliveries_approved, deliveries_only, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries",
      )
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    supabase
      .from("cash_payouts")
      .select("id, store_id, status, confirmed_at, confirmed_by_name")
      .eq("week_start_date", payoutWeekStart),
    // Inactive drivers included, for the same reason leavers are: pay is a week
    // in arrears.
    supabase
      .from("cover_drivers")
      .select("id, name, store_id, hourly_cash_rate, short_delivery_rate, long_delivery_rate, is_active"),
    supabase
      .from("cover_driver_clock_events")
      .select(
        "cover_driver_id, store_id, event_date, clock_in_at, clock_out_at, manual_entry, auto_clocked_out, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries",
      )
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    // The same approved rows the payout prices cover drivers from.
    supabase
      .from("cover_driver_hours_computed")
      .select(
        "cover_driver_id, driver_name, store_id, work_date, total_hours_worked, hourly_rate_snapshot, short_deliveries, long_deliveries, extra_short_deliveries, extra_long_deliveries, short_rate_snapshot, long_rate_snapshot, approved",
      )
      .eq("approved", true)
      .gte("work_date", weekStart)
      .lte("work_date", weekEnd),
    // Rota bookings — display only, to tell a Day Off from a missed shift.
    // Never priced: pay reads approved clock records alone.
    supabase
      .from("rota_shifts")
      .select("employee_id, shift_date, start_time, end_time, is_day_off, is_on_leave")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase
      .from("manager_shifts")
      .select("manager_id, shift_date, start_time, end_time, is_day_off, is_on_leave")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase
      .from("cover_driver_shifts")
      .select("cover_driver_id, shift_date, start_time, end_time, is_day_off, is_on_leave")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
  ]);

  const payouts = (payoutsRes.data ?? []) as Array<{
    id: string;
    store_id: string;
    status: CashPayoutStatus;
    confirmed_at: string | null;
    confirmed_by_name: string | null;
  }>;
  const confirmed = payouts.filter((p) => p.status === "confirmed");
  const storeOfPayout = new Map(confirmed.map((p) => [p.id, p.store_id]));
  const linesRes = confirmed.length
    ? await supabase
        .from("cash_payout_lines")
        .select("payout_id, employee_id, manager_id, cover_driver_id, total_payment")
        .in("payout_id", confirmed.map((p) => p.id))
    : { data: [], error: null };

  const loadError =
    clocksRes.error?.message ??
    sessionsRes.error?.message ??
    employeesRes.error?.message ??
    managersRes.error?.message ??
    managerDaysRes.error?.message ??
    managerSessionsRes.error?.message ??
    coverDriversRes.error?.message ??
    coverClocksRes.error?.message ??
    coverApprovedRes.error?.message ??
    payoutsRes.error?.message ??
    linesRes.error?.message ??
    storesRes.error?.message ??
    rotaRes.error?.message ??
    managerRotaRes.error?.message ??
    coverRotaRes.error?.message ??
    null;

  const frozenLines: StaffWeekFrozenLine[] = (
    (linesRes.data ?? []) as Array<{
      payout_id: string;
      employee_id: string | null;
      manager_id: string | null;
      cover_driver_id: string | null;
      total_payment: number | string;
    }>
  ).map((l) => ({
    store_id: storeOfPayout.get(l.payout_id) ?? "",
    employee_id: l.employee_id,
    manager_id: l.manager_id,
    cover_driver_id: l.cover_driver_id,
    total_payment: l.total_payment,
  }));

  type BookingCols = Omit<StaffWeekBookingRow, "person">;
  const bookings: StaffWeekBookingRow[] = [
    ...((rotaRes.data ?? []) as Array<BookingCols & { employee_id: string }>).map((r) => ({
      ...r,
      person: `emp:${r.employee_id}`,
    })),
    ...((managerRotaRes.data ?? []) as Array<BookingCols & { manager_id: string }>).map((r) => ({
      ...r,
      person: `mgr:${r.manager_id}`,
    })),
    ...((coverRotaRes.data ?? []) as Array<BookingCols & { cover_driver_id: string }>).map((r) => ({
      ...r,
      person: `cd:${r.cover_driver_id}`,
    })),
  ];

  let people = buildStaffWeek({
    weekStart,
    employees: (employeesRes.data ?? []) as Employee[],
    clocks: (clocksRes.data ?? []) as StaffWeekClockRow[],
    sessions: (sessionsRes.data ?? []) as StaffWeekSessionRow[],
    managers: (managersRes.data ?? []) as StaffWeekManager[],
    managerDays: (managerDaysRes.data ?? []) as StaffWeekManagerDay[],
    managerSessions: (managerSessionsRes.data ?? []) as StaffWeekManagerSession[],
    coverDrivers: (coverDriversRes.data ?? []) as StaffWeekCoverDriver[],
    coverClocks: (coverClocksRes.data ?? []) as StaffWeekCoverClock[],
    coverApproved: (coverApprovedRes.data ?? []) as CoverDriverPayRow[],
    bookings,
    frozenLines,
    confirmedStoreIds: confirmed.map((p) => p.store_id),
    includeFixedWage: role === "admin",
  });

  // A manager sees whoever worked at their store this week, plus their own
  // store's staff wherever those worked. The person's WHOLE week is kept — the
  // cash split at this store can't be explained without their other days.
  if (scopeStoreId) {
    people = people.filter(
      (p) => p.homeStoreId === scopeStoreId || p.storeIds.includes(scopeStoreId),
    );
  }

  return {
    weekStart,
    weekEnd,
    payoutWeekStart,
    paymentDate,
    thisWeekStart,
    stores: (storesRes.data ?? []) as { id: string; name: string }[],
    payouts: payouts
      .filter((p) => !scopeStoreId || p.store_id === scopeStoreId)
      .map((p) => ({
        storeId: p.store_id,
        status: p.status,
        confirmedAt: p.confirmed_at,
        confirmedByName: p.confirmed_by_name,
      })),
    people,
    loadError,
  };
}
