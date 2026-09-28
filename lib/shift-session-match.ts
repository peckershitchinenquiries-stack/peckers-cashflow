// =============================================================
// Which SHIFT did each clocked session serve? (Update 225)
//
// A day can hold several booked shifts at DIFFERENT stores — Hitchin 11:00–17:00
// then Stevenage 17:00–23:00 — and several clocked sessions underneath one day
// header. Anything that judges attendance per booking (compliance alerts, shift
// reminders) has to pair them up, because the header answers only "what did this
// person do all day": its clock_in_at is the morning's, its clock_out_at the
// evening's, and its worked_hours the sum. Compared against a single 6h booking
// those read as a no-show that never happened, an 11h variance, and an early
// finish that can never be seen.
//
// Store FIRST, then nearest start. A second pass ignores the store so a day
// booked at one store but worked at another still pairs up — that is a cross-
// cover, not an absence, and raising one would be pure noise.
//
// Pure and dependency-light so both the server actions and the cron route can
// share it.
// =============================================================

import { londonHHMM, timeToMinutes } from "@/lib/utils";

export type MatchableShift = {
  store_id: string | null;
  start_time: string | null;
};

export type MatchableSession = {
  store_id?: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
};

export type ShiftMatch<Sh, Se> = {
  shift: Sh;
  sessions: Se[];
};

/** Minutes-since-midnight of an instant in LONDON wall-clock terms. */
function sessionStartMinutes(s: MatchableSession): number {
  return timeToMinutes(londonHHMM(new Date(s.clock_in_at)));
}

/**
 * Distance between a booked start and a clocked start, in minutes, tolerating
 * the midnight wrap: an 23:00 booking clocked at 00:10 is 70 minutes out, not
 * 1370.
 */
function startDistance(shiftStart: number, sessionStart: number): number {
  const raw = Math.abs(sessionStart - shiftStart);
  return Math.min(raw, 1440 - raw);
}

/**
 * Pair a day's booked shifts with the sessions that served them.
 *
 * Every shift comes back, in the order given, even with no session attached —
 * that empty list is exactly what an absence check needs. Sessions no booking
 * claimed are attached to the nearest shift rather than dropped, so a day with
 * ONE booking and two clocked shifts still totals both against it, unchanged
 * from before this matcher existed.
 */
export function matchSessionsToShifts<Sh extends MatchableShift, Se extends MatchableSession>(
  shifts: Sh[],
  sessions: Se[],
): Array<ShiftMatch<Sh, Se>> {
  const matches: Array<ShiftMatch<Sh, Se>> = shifts.map((shift) => ({ shift, sessions: [] }));
  if (matches.length === 0 || sessions.length === 0) return matches;

  const claimed = new Set<Se>();
  // Earliest booking picks first, so the morning shift can't be handed the
  // evening's session just because it was considered later.
  const order = matches
    .map((m, i) => i)
    .filter((i) => matches[i].shift.start_time)
    .sort((a, b) =>
      timeToMinutes(matches[a].shift.start_time!) - timeToMinutes(matches[b].shift.start_time!),
    );

  for (const sameStoreOnly of [true, false]) {
    for (const i of order) {
      const m = matches[i];
      if (m.sessions.length > 0) continue;
      const startMin = timeToMinutes(m.shift.start_time!);
      let best: Se | null = null;
      let bestDist = Infinity;
      for (const s of sessions) {
        if (claimed.has(s)) continue;
        if (sameStoreOnly && (s.store_id ?? null) !== m.shift.store_id) continue;
        const dist = startDistance(startMin, sessionStartMinutes(s));
        if (dist < bestDist) {
          best = s;
          bestDist = dist;
        }
      }
      if (best) {
        m.sessions.push(best);
        claimed.add(best);
      }
    }
  }

  // Leftovers: a break split into two sessions, or an extra shift nobody booked.
  // They belong to whichever booking they sit closest to — dropping them would
  // understate the day and report a variance against hours that were worked.
  for (const s of sessions) {
    if (claimed.has(s)) continue;
    const sStart = sessionStartMinutes(s);
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const i of order) {
      const dist = startDistance(timeToMinutes(matches[i].shift.start_time!), sStart);
      if (dist < bestDist) {
        bestIdx = i;
        bestDist = dist;
      }
    }
    if (bestIdx >= 0) matches[bestIdx].sessions.push(s);
  }

  return matches;
}

/** What a shift's matched sessions actually amount to. */
export type ShiftActual = {
  /** Earliest clock-in among the matched sessions. */
  firstIn: string | null;
  /** Latest clock-out, or NULL while any matched session is still open. */
  lastOut: string | null;
  /** Summed hours of the COMPLETED matched sessions. */
  hours: number;
};

export function shiftActual(sessions: MatchableSession[]): ShiftActual {
  if (sessions.length === 0) return { firstIn: null, lastOut: null, hours: 0 };
  const open = sessions.some((s) => !s.clock_out_at);
  let firstIn = sessions[0].clock_in_at;
  let lastOut: string | null = null;
  let hours = 0;
  for (const s of sessions) {
    if (new Date(s.clock_in_at).getTime() < new Date(firstIn).getTime()) firstIn = s.clock_in_at;
    if (!s.clock_out_at) continue;
    if (!lastOut || new Date(s.clock_out_at).getTime() > new Date(lastOut).getTime()) {
      lastOut = s.clock_out_at;
    }
    const ms = new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime();
    if (ms > 0) hours += ms / 3_600_000;
  }
  return { firstIn, lastOut: open ? null : lastOut, hours };
}
