// =============================================================
// Early clock-in — the ONE rule, shared by the client pre-check and the server
// gate (Update 180).
//
// Clock-in is strict to the booked rota shift: nobody may start before their
// booked start time, and there is no override from the employee's side. A
// manager who genuinely wants someone to start early records that start with a
// manual clock entry. Clocking OUT is never restricted.
//
// CrewClockApp evaluates the rule from props it already holds, so an early press
// is refused without a server round-trip. That client check is UX only —
// performClockIn evaluates the same rule server-side and refuses independently,
// or the gate would be bypassable by calling the action directly.
//
// Deliberately pure: no Node, no Supabase, nothing that cannot reach a client
// bundle.
// =============================================================

import { timeToMinutes } from "@/lib/utils";

/**
 * How many minutes before the booked start still count as on time. Zero today —
 * clocking in at or after the scheduled minute is allowed. Named so it can be
 * widened without hunting for the comparison.
 */
export const EARLY_CLOCK_IN_GRACE_MINUTES = 0;

/**
 * The booked start to measure earliness against, in minutes, or null when there
 * is nothing to be early for.
 *
 * Only a BOOKING counts. `employee_schedules` is availability — a recurring
 * pattern that never creates a shift (see CLAUDE.md) — so a day with no
 * `rota_shifts` row, a day off, or a booking with no start time all clock in
 * freely.
 */
export function bookableStartMinutes(
  shift: { is_day_off?: boolean | null; start_time: string | null } | null,
): number | null {
  if (!shift || shift.is_day_off || !shift.start_time) return null;
  return timeToMinutes(shift.start_time);
}

/**
 * `nowMinutes` and `scheduledStartMinutes` are both LONDON wall-clock minutes —
 * derived through londonHHMM + timeToMinutes, never Date#getHours(), which
 * answers in whatever timezone the reader happens to be in.
 */
export function isEarlyClockIn(args: {
  nowMinutes: number;
  scheduledStartMinutes: number | null;
  hasSessionToday: boolean;
}): boolean {
  if (args.scheduledStartMinutes == null) return false;
  // Second and later shifts are never gated: the first one already started at
  // or after the booked time (or was entered by a manager).
  if (args.hasSessionToday) return false;
  return args.nowMinutes < args.scheduledStartMinutes - EARLY_CLOCK_IN_GRACE_MINUTES;
}

/** The refusal shown to the employee, identical on the client and the server. */
export function earlyClockInMessage(scheduledStartMinutes: number): string {
  const h = Math.floor(scheduledStartMinutes / 60);
  const m = scheduledStartMinutes % 60;
  const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `Your shift starts at ${hhmm}. You can't clock in before your scheduled start time.`;
}
