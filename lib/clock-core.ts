// =============================================================
// The shared employee clock-IN routine, and the helpers every clock write path
// uses.
//
// This lives in lib/ rather than app/actions/clock.ts because every export of a
// "use server" module is a client-callable endpoint, and these are internal
// building blocks shared with the manager-entry path — not endpoints.
// =============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { writeAudit } from "@/app/actions/audit";
import { scanForAlertsBackground } from "@/app/actions/alerts";
import {
  londonHHMM,
  parseISODate,
  roundHoursToMinute,
  startOfISOWeek,
  timeToMinutes,
  toISODate,
  todayISO,
} from "@/lib/utils";
import { detectStoreForLocation } from "@/lib/geofence-verify";
import { findEmployeeForUser } from "@/lib/employee-lookup";
import {
  addSession,
  adoptHeaderIntoSession,
  earliestSessionInAtStore,
  findOpenSession,
  hasSessionOnDate,
  recomputeDayHeader,
} from "@/lib/clock-sessions";
import { employeeNiRate, rollupApprovedWeek } from "@/lib/employee-hours-rollup";
import {
  bookableStartMinutes,
  earlyClockInMessage,
  isEarlyClockIn,
} from "@/lib/early-clock-in";
import type { ActionResult } from "@/lib/types";

/** Marker note for shifts the system created from a clock-in (no rota entry). */
export const AUTO_SHIFT_NOTE = "Auto-created from clock-in";

/**
 * Boundary for user-triggered clock actions: converts a thrown error into a
 * returned { ok:false, error } so the message survives production. Next.js
 * masks messages thrown from server actions in prod builds — without this,
 * every validation error ("You're 300m from the store", "account not active",
 * …) surfaces to the employee as a generic 500.
 */
export async function asResult(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
    return { ok: true };
  } catch (err) {
    console.error("[clock] action failed:", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}

export async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

export async function getEmployeeForUser(userId: string, userEmail: string) {
  return findEmployeeForUser(createServerSupabase(), userId, userEmail);
}

export type ClockInShiftCandidate = {
  id: string;
  is_day_off: boolean;
  start_time: string | null;
  store_id: string | null;
};

/**
 * Find the rota shift a clock-in should attach to. A day can now hold several
 * booked shifts (migration 032 dropped the one-per-day constraint), so this
 * can no longer be a `.maybeSingle()` lookup — that throws the moment a
 * second shift exists for the day, which would break clock-in outright for
 * anyone with a split shift booked.
 *
 * STORE FIRST (Update 225). The day's bookings can be at different stores —
 * Hitchin 11:00–17:00 then Stevenage 17:00–23:00 — and only the booking at the
 * store they are standing in describes the shift they are starting. Picking the
 * day's earliest booking regardless of store got two things wrong:
 *   - the early clock-in gate measured the Stevenage shift against Hitchin's
 *     11:00, so someone who skipped the morning could start at 11:00 and the
 *     refusal named the wrong time;
 *   - a second store with NO booking resolved to the first store's cell, so
 *     `applyAutoShiftForClockIn` saw a real booking and created nothing — store
 *     A's Rota then absorbed both halves and store B showed zero.
 *
 * Picks, in order:
 *   1. At `storeId`: a shift needing conversion (day off / no start time) first
 *      — the "clocked in without a real booking yet" case — else the earliest
 *      booked one there.
 *   2. A convertible shift at ANY store: it has no times of its own to lose and
 *      `applyAutoShiftForClockIn` moves it to where they actually turned up,
 *      which is what it always did.
 *   3. Otherwise NULL — every booking today belongs to another store, so this is
 *      unbooked cover and needs a cell of its own at `storeId`.
 */
export async function findShiftForClockIn(
  supabase: ReturnType<typeof createServerSupabase>,
  employeeId: string,
  date: string,
  storeId: string | null,
): Promise<ClockInShiftCandidate | null> {
  const { data } = await supabase
    .from("rota_shifts")
    .select("id, is_day_off, start_time, store_id")
    .eq("employee_id", employeeId)
    .eq("shift_date", date)
    .order("start_time", { ascending: true, nullsFirst: true });
  const rows = (data ?? []) as ClockInShiftCandidate[];
  if (rows.length === 0) return null;

  const convertible = (s: ClockInShiftCandidate) => s.is_day_off || !s.start_time;
  const here = storeId ? rows.filter((s) => s.store_id === storeId) : rows;
  if (here.length > 0) return here.find(convertible) ?? here[0];
  return rows.find(convertible) ?? null;
}

/**
 * Reflect a clock-in on the rota so the employee shows as present that day.
 * Two cases need a system-managed shift:
 *   1. No shift row at all → create one (start = clock-in time).
 *   2. A row exists but it's a Day Off or has no start time → convert it to a
 *      working shift. (The "clocked in on a day off / covering" case.) A real
 *      scheduled shift is left untouched.
 *
 * Shared by self clock-in and manager-entered clock-in so a manually recorded
 * day appears on the Rota exactly like a real one — that parity is the whole
 * point of the manual-entry feature.
 *
 * Best-effort: this is a convenience, not a requirement. It needs the
 * service-role client (employees can't write rota_shifts under RLS), so if
 * provisioning isn't configured — or anything else fails — swallow it. It must
 * NEVER block the clock-in itself.
 *
 * Returns the shift id to attach to the clock row, if there is one.
 */
export async function applyAutoShiftForClockIn(input: {
  employeeId: string;
  storeId: string;
  eventDate: string;
  /** HH:MM in UK wall-clock time. */
  startTime: string;
  shift: { id: string; is_day_off: boolean; start_time: string | null } | null;
}): Promise<string | null> {
  const { employeeId, storeId, eventDate, startTime, shift } = input;
  let shiftId = shift?.id ?? null;

  const needsAutoShift = !shift || shift.is_day_off || !shift.start_time;
  if (!needsAutoShift) return shiftId;

  try {
    if (isProvisioningConfigured()) {
      const admin = createAdminClient();
      if (!shift) {
        const { data: created } = await admin
          .from("rota_shifts")
          .insert({
            employee_id: employeeId,
            store_id: storeId,
            shift_date: eventDate,
            start_time: startTime,
            end_time: null,
            is_day_off: false,
            scheduled_hours: 0,
            manager_notes: AUTO_SHIFT_NOTE,
          })
          .select("id")
          .maybeSingle();
        if (created) shiftId = created.id;
      } else {
        // Convert the existing day-off / empty shift into a worked one at the
        // store they actually turned up to (they may be covering elsewhere).
        await admin
          .from("rota_shifts")
          .update({
            store_id: storeId,
            start_time: startTime,
            end_time: null,
            is_day_off: false,
            scheduled_hours: 0,
            manager_notes: AUTO_SHIFT_NOTE,
          })
          .eq("id", shift.id);
        shiftId = shift.id;
      }
    }
  } catch (err) {
    console.error(
      "[clock] auto-shift creation failed (clock-in continues):",
      err instanceof Error ? err.message : err,
    );
  }
  return shiftId;
}

/**
 * Stamp EVERY auto-created rota cell the day owns, one per store (Update 225).
 *
 * A cross-store day has a cell at each store, and each must read only its own
 * store's window — end at that store's latest clock-out, total that store's
 * summed hours. The single-cell version stamped whichever cell the day header's
 * `shift_id` happened to point at (the LAST store clocked into) with the whole
 * day's hours, so store B's Rota billed store A's morning as well.
 *
 * A manager-booked cell is still never touched: only AUTO_SHIFT_NOTE cells are
 * system-managed, which is why an unbooked cover day is the only one this bites.
 *
 * Best-effort throughout: needs the service-role client, and must never block a
 * clock action.
 */
export async function stampAutoShiftsForDay(
  supabase: ReturnType<typeof createServerSupabase>,
  input: {
    employeeId: string;
    eventDate: string;
    sessions: Array<{
      store_id?: string | null;
      clock_in_at: string;
      clock_out_at: string | null;
    }>;
  },
) {
  if (!isProvisioningConfigured()) return;
  try {
    const { data: cells } = await supabase
      .from("rota_shifts")
      .select("id, store_id, start_time, manager_notes")
      .eq("employee_id", input.employeeId)
      .eq("shift_date", input.eventDate);
    const autoCells = (cells ?? []).filter(
      (c) => c.start_time && c.manager_notes === AUTO_SHIFT_NOTE,
    );
    if (autoCells.length === 0) return;

    const admin = createAdminClient();
    for (const cell of autoCells) {
      const mine = input.sessions.filter(
        (x) => (x.store_id ?? null) === cell.store_id && x.clock_out_at,
      );
      // Nothing finished at this store yet — leave the cell open rather than
      // writing a zero over a window a previous shift already stamped.
      if (mine.length === 0) continue;
      const lastOut = mine.reduce(
        (max, x) =>
          new Date(x.clock_out_at!).getTime() > new Date(max).getTime() ? x.clock_out_at! : max,
        mine[0].clock_out_at!,
      );
      const hours = mine.reduce((sum, x) => {
        const ms = new Date(x.clock_out_at!).getTime() - new Date(x.clock_in_at).getTime();
        return sum + (ms > 0 ? ms / 3_600_000 : 0);
      }, 0);
      await admin
        .from("rota_shifts")
        .update({
          end_time: londonHHMM(new Date(lastOut)),
          scheduled_hours: roundHoursToMinute(hours),
        })
        .eq("id", cell.id);
    }
  } catch (err) {
    console.error(
      "[clock] auto-shift end-stamp failed (clock action continues):",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * A day that was already approved has just gained another shift, so the
 * approved figure is no longer the day's total. Revoke the approval and
 * re-roll the week, putting the day back in the manager's pending queue.
 *
 * Without this the second shift is invisible to payroll: resolvedDayHours
 * prefers approved_hours, so a day approved at 4h stays paid at 4h no matter
 * how much more was worked.
 *
 * Service-role, because employee_hours writes are staff-only under RLS and the
 * actor here is the employee. Best-effort — it must never block a clock-in.
 */
async function revokeApprovalForAddedShift(input: {
  clockEventId: string;
  employeeId: string;
  eventDate: string;
}) {
  if (!isProvisioningConfigured()) return;
  try {
    const admin = createAdminClient();
    // Only the day's roll-up is restated. The already-approved shift KEEPS its
    // approval and keeps paying (migration 035) — it was worked and signed off,
    // and starting a second shift is no reason to take the first one back off
    // the sheet. recomputeDayHeader flips hours_approved to false because the
    // new shift is outstanding, which is what returns the day to the queue.
    await admin
      .from("clock_events")
      .update({ hours_approved_by: null, hours_approved_at: null })
      .eq("id", input.clockEventId);

    const rate = await employeeNiRate(admin, input.employeeId);
    const weekStart = toISODate(startOfISOWeek(parseISODate(input.eventDate)));
    await rollupApprovedWeek(admin, input.employeeId, weekStart, rate, null);

    await writeAudit({
      action: "approval_revoked_new_shift",
      entity: "clock_event",
      entity_id: input.clockEventId,
      changes: {
        employee_id: input.employeeId,
        event_date: input.eventDate,
        reason: "Another shift was started on an already-approved day",
      },
    });
  } catch (err) {
    console.error(
      "[clock] could not revoke approval for an added shift:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Paths refreshed after any clock write, self-service or manager-entered. */
export function revalidateClockPaths() {
  revalidatePath("/employee/attendance");
  revalidatePath("/live");
  revalidatePath("/manager/live");
  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  // A clock write moves the payout too: a new shift lands unapproved, which
  // takes the day back off the sheet until it's signed off (migration 035).
  revalidatePath("/cash-flow/payout");
  revalidatePath("/manager/cash-flow/payout");
}

/** London wall-clock minutes since midnight — never Date#getHours(), which
 *  answers in the server's timezone. */
export function londonNowMinutes(now: Date = new Date()): number {
  return timeToMinutes(londonHHMM(now));
}

/**
 * Refuse a clock-in made before the employee's booked start (Update 180).
 *
 * The crew screen refuses an early press itself, so this is rarely what the
 * employee sees. It exists because a gate enforced only in the client is not a
 * gate — without it the rule is bypassed by calling clockIn() directly. Both
 * sides evaluate isEarlyClockIn so they cannot disagree.
 */
async function assertNotEarlyClockIn(
  supabase: ReturnType<typeof createServerSupabase>,
  employeeId: string,
  eventDate: string,
  shift: ClockInShiftCandidate | null,
) {
  const scheduledStartMinutes = bookableStartMinutes(shift);
  if (scheduledStartMinutes == null) return;
  const early = isEarlyClockIn({
    nowMinutes: londonNowMinutes(),
    scheduledStartMinutes,
    hasSessionToday: await hasSessionOnDate(supabase, employeeId, eventDate),
  });
  if (early) throw new Error(earlyClockInMessage(scheduledStartMinutes));
}

/** The position the clock-in is judged against, captured at the button press. */
export type ClockInFix = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  /** Age of the fix in ms — see ReportedFix. Stale positions are refused. */
  fix_age_ms: number | null;
};

export type ClockInOutcome = {
  clockEventId: string;
  clockInAt: string;
  storeId: string;
};

export async function performClockIn(ctx: ClockInFix): Promise<ClockInOutcome> {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  const employee = await getEmployeeForUser(user.id, user.email);
  if (!employee) throw new Error("Your account is not linked to a crew profile.");
  if (employee.employment_status === "left" || employee.employment_status === "inactive") {
    throw new Error("Your account is not active.");
  }

  // Staff can work at any store, not only their home one. The store is detected
  // from where they're standing — that store is where the day's work (and
  // wages) are attributed — which also verifies they're in range and that the
  // fix is recent enough to prove where they are NOW.
  const detected = await detectStoreForLocation(
    supabase,
    {
      lat: ctx.latitude,
      lng: ctx.longitude,
      accuracy: ctx.accuracy,
      ageMs: ctx.fix_age_ms,
    },
    { actorEmail: user.email, employeeId: employee.id, action: "clock_in" },
  );
  const workedStoreId = detected.id;

  const today = todayISO();

  // The only thing that blocks a clock-in is ALREADY BEING CLOCKED IN. A day can
  // hold several shifts — morning, break, evening — so "you've already clocked
  // in today" is no longer a reason to refuse. The open session is looked up
  // across every date, not just today, because a shift opened at 22:00 and
  // still running belongs to yesterday.
  const open = await findOpenSession(supabase, employee.id);
  if (open) {
    throw new Error(
      open.event_date === today
        ? "You're already clocked in. Clock out before starting another shift."
        : `You're still clocked in from ${open.event_date}. Clock out of that shift first.`,
    );
  }

  // Link to today's scheduled shift if one exists. Clock-in is self-service:
  // staff can clock in whenever they're on-site, with or without a shift on the
  // rota (covering a colleague, picking up an extra shift, etc.). A scheduled
  // shift simply gets attached so the Live board can compare planned vs actual.
  // Scoped to the store they're standing in: the day's other booking may be at
  // the other store, and both the early gate below and the rota cell must judge
  // THIS shift (Update 225).
  const shift = await findShiftForClockIn(supabase, employee.id, today, workedStoreId);

  await assertNotEarlyClockIn(supabase, employee.id, today, shift);

  const { data: existing } = await supabase
    .from("clock_events")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("event_date", today)
    .maybeSingle();

  const nowDate = new Date();
  const now = nowDate.toISOString();

  // Later shifts must not move the rota cell's start time — the cell began when
  // this STORE's first shift did. The day header's clock_in_at is the earliest
  // across every store, so on a cross-store day it would open a fresh Hitchin
  // cell at the Stevenage morning's time.
  const storeFirstIn = await earliestSessionInAtStore(
    supabase,
    employee.id,
    today,
    workedStoreId,
  );
  const shiftId = await applyAutoShiftForClockIn({
    employeeId: employee.id,
    storeId: workedStoreId,
    eventDate: today,
    startTime: londonHHMM(storeFirstIn ? new Date(storeFirstIn) : nowDate),
    shift,
  });

  // One header row per day, unchanged (clock_events_unique). It carries the
  // day's store and rota link; the shift itself goes in clock_sessions.
  let clockEventId = existing?.id as string | undefined;
  if (existing) {
    const { error } = await supabase
      .from("clock_events")
      // The day's store is deliberately NOT written here: recomputeDayHeader
      // derives it from the shifts below, so clocking in at another store moves
      // the day there rather than leaving it frozen at wherever it started.
      .update({ shift_id: shiftId })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("clock_events")
      .insert({
        employee_id: employee.id,
        shift_id: shiftId,
        store_id: workedStoreId,
        event_date: today,
        clock_in_at: now,
        clock_in_lat: ctx.latitude,
        clock_in_lng: ctx.longitude,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    clockEventId = created?.id;
  }
  if (!clockEventId) throw new Error("Could not record the clock-in. Please try again.");

  // A pre-029 day may have a clock-in on the header but no session to sit
  // beside. Adopt it so the day's shifts are complete before adding this one.
  if (existing?.clock_in_at) {
    await adoptHeaderIntoSession(supabase, {
      ...existing,
      id: existing.id,
      employee_id: employee.id,
      store_id: existing.store_id,
      event_date: today,
    });
  }

  await addSession(supabase, {
    clockEventId,
    employeeId: employee.id,
    storeId: workedStoreId,
    eventDate: today,
    clockInAt: now,
    lat: ctx.latitude,
    lng: ctx.longitude,
  });

  await recomputeDayHeader(supabase, clockEventId);

  // Signing off 4h and then working another 4h must not leave the day reading
  // as fully approved. The new shift is unapproved, so recomputeDayHeader has
  // already returned the day to the pending queue; this clears the stale
  // "approved by" stamp and restates the week.
  if (existing?.hours_approved) {
    await revokeApprovalForAddedShift({
      clockEventId,
      employeeId: employee.id,
      eventDate: today,
    });
  }

  await writeAudit({
    action: "clock_in",
    entity: "clock_event",
    entity_id: employee.id,
    changes: {
      date: today,
      location: [ctx.latitude, ctx.longitude],
    },
  });

  // Auto-scan so late/variance alerts surface without a manual "Scan now".
  // Best-effort: never let a scan failure block the clock-in.
  await scanForAlertsBackground();

  revalidateClockPaths();

  return { clockEventId, clockInAt: now, storeId: workedStoreId };
}
