// One-off repair for the two cross-store days broken before Update 224.
//
//   Rohith Boora, Sat 26/09 — drove Hitchin → Stevenage and never clocked out
//     and back in, so ONE Hitchin session covers both stores. A manager then
//     approved it at 5h of the 10.62h clocked, so Stevenage was paid nothing
//     and every drop billed to Hitchin. Split into two shifts.
//
//   Pavan, Fri 25/09 — clocked into Stevenage at 16:54, six minutes before its
//     17:00 booking, so the nightly sweep matched the HITCHIN booking and
//     closed him at 17:00. Five minutes recorded for an eight-hour shift, and
//     no delivery counts. Correct the end time and enter the drops.
//
// Nothing here invents a figure. Every time and count below is a CONFIG value
// for a manager to confirm against what actually happened; the script only
// writes what it is told and then lets recomputeDayHeader derive the day, so
// the header stays a derived summary and cannot drift from its shifts.
//
// Approval state is PRESERVED, never changed: Rohith's day was approved, so
// both of its shifts come back approved at their own clocked hours; Pavan's
// was pending, so it stays pending for a manager to sign off on Daily Approval.
//
//   Dry run (default):  npx tsx -r ./scripts/_script-env.cjs scripts/repair-cross-store-days.ts
//   Apply:              npx tsx -r ./scripts/_script-env.cjs scripts/repair-cross-store-days.ts --apply

import { createClient } from "@supabase/supabase-js";
import {
  addSession,
  recomputeDayHeader,
  setSessionApproval,
  setSessionDeliveries,
  unapproveDaySessions,
} from "../lib/clock-sessions";
import { employeeNiRate, rollupApprovedWeek } from "../lib/employee-hours-rollup";
import { parseISODate, startOfISOWeek, toISODate } from "../lib/utils";

// =====================================================================
// CONFIRM EVERYTHING IN THIS BLOCK BEFORE RUNNING WITH --apply
// Times are LONDON wall clock, written as ISO with the +01:00 BST offset.
// =====================================================================

/** Who is credited as having entered these corrections. */
const REPAIRED_BY_EMAIL = "Peckersstevenage@hotmail.com";

const ROHITH = {
  label: "Rohith Boora — Sat 26/09",
  employeeId: "939073b6-8df1-470d-af8c-8be969f55320",
  eventId: "cb0d1582-18e1-48dc-9fa5-bbd61c45f979",
  eventDate: "2026-09-26",
  /** The single Hitchin session that currently covers both stores. */
  sessionId: "70dd89e8-d7dc-4e55-91ad-a1c158c2bd2c",
  hitchinStoreId: "ba5fa30b-6d6d-45f4-8cbc-0a962d560763",
  stevenageStoreId: "b7506e8d-4eea-4502-8870-e61bbe1775ca",

  // RECORDED: clocked in at Hitchin 13:14, clocked out at Stevenage 23:50.
  // You said 11:20–16:10 Hitchin then 16:10–23:50 Stevenage. The 23:50 finish
  // matches the GPS-verified clock-out exactly. The 11:20 start does NOT match
  // the GPS-verified clock-in of 13:14 — CONFIRM WHICH IS RIGHT.
  hitchinStart: "2026-09-26T13:14:00+01:00", // recorded clock-in (GPS: Hitchin)
  handover: "2026-09-26T16:10:00+01:00", // when he left Hitchin for Stevenage
  stevenageEnd: "2026-09-26T23:50:00+01:00", // recorded clock-out (GPS: Stevenage)

  // The day's recorded drops were 6 SD / 1 LD / 0 MS / 1 ML ("Walkern"), all
  // currently billed to Hitchin. Split them by where they were actually run.
  hitchinDrops: {
    short: 2,
    long: 0,
    extraShort: 0,
    extraLong: 0,
    extraShortReason: null,
    extraLongReason: null,
  },
  stevenageDrops: {
    short: 4,
    long: 1,
    extraShort: 0,
    extraLong: 1,
    extraShortReason: null,
    extraLongReason: "Walkern",
  },

  /** The day was approved before the repair, so it is approved after it. */
  reapprove: true,
  reason:
    "Update 224 repair: day worked Hitchin then Stevenage on one clock session; split to the real shifts so each store pays its own.",
};

const PAVAN = {
  label: "Pavan — Fri 25/09",
  employeeId: "a03c5f7f-5c13-48db-971d-05841def4a78",
  eventId: "b68e1ec9-4602-4bd8-9de5-20e643af328c",
  eventDate: "2026-09-25",
  /** The Stevenage evening shift the sweep closed at the Hitchin end time. */
  sessionId: "42e234f5-a6ad-49dd-b2bf-0494b20b216e",

  // RECORDED: clocked into Stevenage 16:54, auto-closed 17:00 from the wrong
  // booking. You said he worked to 01:00. The Hitchin shift beneath it
  // (11:56–16:54) is correct and is NOT touched.
  stevenageEnd: "2026-09-26T01:00:00+01:00", // CONFIRM the real finish

  // This shift recorded no counts at all — its clock-out never happened.
  stevenageDrops: {
    short: 0,
    long: 0,
    extraShort: 0,
    extraLong: 0,
    extraShortReason: null,
    extraLongReason: null,
  },

  /** The day was pending before the repair, so it stays pending. */
  reapprove: false,
  reason:
    "Update 224 repair: auto clock-out matched the Hitchin booking and closed this Stevenage shift at 17:00; corrected to the real finish.",
};

// =====================================================================

const APPLY = process.argv.includes("--apply");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const LONDON = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const at = (iso: string | null) => (iso ? LONDON.format(new Date(iso)) : "—");
const hours = (a: string, b: string) =>
  ((new Date(b).getTime() - new Date(a).getTime()) / 3_600_000).toFixed(2);

async function actorId(): Promise<string> {
  const { data } = await sb
    .from("allowed_users")
    .select("id")
    .eq("email", REPAIRED_BY_EMAIL)
    .maybeSingle();
  if (!data?.id) throw new Error(`No allowed_users row for ${REPAIRED_BY_EMAIL}`);
  return data.id as string;
}

async function showDay(label: string, eventId: string) {
  const { data: ce } = await sb
    .from("clock_events")
    .select(
      "store_id, event_date, clock_in_at, clock_out_at, worked_hours, session_count, hours_approved, approved_hours, auto_clocked_out, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries",
    )
    .eq("id", eventId)
    .maybeSingle();
  const { data: rows } = await sb
    .from("clock_sessions")
    .select(
      "id, seq, store_id, clock_in_at, clock_out_at, hours_approved, approved_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, auto_clocked_out, manual_entry",
    )
    .eq("clock_event_id", eventId)
    .order("clock_in_at");
  const { data: stores } = await sb.from("stores").select("id, name");
  const name = new Map((stores ?? []).map((s) => [s.id, (s.name as string).replace(" Peckers", "")]));

  console.log(`\n  ${label}`);
  console.log(
    `    day    ${name.get(ce?.store_id ?? "") ?? "—"}  ${at(ce?.clock_in_at ?? null)}–${at(
      ce?.clock_out_at ?? null,
    )}  ${Number(ce?.worked_hours ?? 0).toFixed(2)}h  ${ce?.session_count ?? 0} shift(s)  ${
      ce?.hours_approved ? `approved ${Number(ce?.approved_hours ?? 0).toFixed(2)}h` : "PENDING"
    }${ce?.auto_clocked_out ? "  [auto-out]" : ""}`,
  );
  for (const r of rows ?? []) {
    console.log(
      `    #${r.seq}     ${(name.get(r.store_id ?? "") ?? "—").padEnd(10)} ${at(
        r.clock_in_at,
      )}–${at(r.clock_out_at)}  ${
        r.clock_out_at ? `${hours(r.clock_in_at, r.clock_out_at)}h` : "open"
      }  ${r.short_deliveries_count ?? 0}sd ${r.long_deliveries_count ?? 0}ld ${
        r.extra_short_deliveries ?? 0
      }ms ${r.extra_long_deliveries ?? 0}ml  ${
        r.hours_approved
          ? `approved${r.approved_hours != null ? ` ${Number(r.approved_hours).toFixed(2)}h` : ""}`
          : "pending"
      }${r.auto_clocked_out ? " [auto]" : ""}${r.manual_entry ? " [manual]" : ""}`,
    );
  }
}

async function repairRohith(by: string) {
  const c = ROHITH;

  // Withdraw first. Approval is what makes a shift payable, and the shape it
  // was signed off against is about to stop existing.
  await unapproveDaySessions(sb, c.eventId, by);

  // The existing session becomes the HITCHIN half. Its clock-in and that
  // clock-in's GPS are genuine and stay; the clock-out is now a manager's
  // statement of when he left, so its coordinates go — they were recorded at
  // Stevenage, hours later, and a row with no coordinates is exactly how this
  // codebase says "never location-verified".
  const { error: shrinkErr } = await sb
    .from("clock_sessions")
    .update({
      store_id: c.hitchinStoreId,
      clock_out_at: c.hitchinStart === c.handover ? null : c.handover,
      clock_out_lat: null,
      clock_out_lng: null,
      clock_in_at: c.hitchinStart,
      manual_entry: true,
      manual_entry_by: by,
      manual_entry_at: new Date().toISOString(),
      manual_entry_reason: c.reason,
    })
    .eq("id", c.sessionId);
  if (shrinkErr) throw new Error(shrinkErr.message);
  await setSessionDeliveries(sb, c.sessionId, c.hitchinDrops);

  // The Stevenage half. Inserted already closed, so it can never occupy the
  // one-open-session slot.
  const evening = await addSession(sb, {
    clockEventId: c.eventId,
    employeeId: c.employeeId,
    storeId: c.stevenageStoreId,
    eventDate: c.eventDate,
    clockInAt: c.handover,
    clockOutAt: c.stevenageEnd,
    manual: { by, at: new Date().toISOString(), reason: c.reason },
    deliveries: c.stevenageDrops,
  });

  if (c.reapprove) {
    // Each shift at its OWN clocked length. No day total is passed anywhere:
    // that is the thing Update 224 refuses on a cross-store day, and passing
    // one here would put the whole correction on a single store's till.
    for (const id of [c.sessionId, evening.id]) {
      await setSessionApproval(sb, id, { approved: true, approvedHours: null, by });
    }
  }

  await recomputeDayHeader(sb, c.eventId);
  // The header's auto flags described the old shape and nothing derives them.
  await sb
    .from("clock_events")
    .update({
      auto_clocked_out: false,
      auto_clock_out_source: null,
      auto_clock_out_at: null,
      manual_entry: true,
      manual_entry_by: by,
      manual_entry_at: new Date().toISOString(),
      manual_entry_reason: c.reason,
      ...(c.reapprove
        ? { hours_approved_by: by, hours_approved_at: new Date().toISOString() }
        : { hours_approved_by: null, hours_approved_at: null }),
    })
    .eq("id", c.eventId);
}

async function repairPavan(by: string) {
  const c = PAVAN;

  const { error } = await sb
    .from("clock_sessions")
    .update({
      clock_out_at: c.stevenageEnd,
      // The 17:00 finish was the sweep's, from the wrong booking. A manager is
      // now stating the real one, so this stops being an automatic close.
      auto_clocked_out: false,
      auto_clock_out_source: null,
      auto_clock_out_at: null,
      clock_out_lat: null,
      clock_out_lng: null,
      manual_entry: true,
      manual_entry_by: by,
      manual_entry_at: new Date().toISOString(),
      manual_entry_reason: c.reason,
    })
    .eq("id", c.sessionId);
  if (error) throw new Error(error.message);
  await setSessionDeliveries(sb, c.sessionId, c.stevenageDrops);

  await recomputeDayHeader(sb, c.eventId);
  await sb
    .from("clock_events")
    .update({
      auto_clocked_out: false,
      auto_clock_out_source: null,
      auto_clock_out_at: null,
    })
    .eq("id", c.eventId);
}

async function reroll(employeeId: string, eventDate: string, by: string) {
  const rate = await employeeNiRate(sb, employeeId);
  const weekStart = toISODate(startOfISOWeek(parseISODate(eventDate)));
  await rollupApprovedWeek(sb, employeeId, weekStart, rate, by);
}

async function main() {
  console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN (pass --apply to write) ===");

  console.log("\nBEFORE");
  await showDay(ROHITH.label, ROHITH.eventId);
  await showDay(PAVAN.label, PAVAN.eventId);

  console.log("\nPLANNED");
  console.log(`\n  ${ROHITH.label}`);
  console.log(
    `    #1     Hitchin    ${at(ROHITH.hitchinStart)}–${at(ROHITH.handover)}  ${hours(
      ROHITH.hitchinStart,
      ROHITH.handover,
    )}h  ${ROHITH.hitchinDrops.short}sd ${ROHITH.hitchinDrops.long}ld ${ROHITH.hitchinDrops.extraShort}ms ${ROHITH.hitchinDrops.extraLong}ml`,
  );
  console.log(
    `    #2     Stevenage  ${at(ROHITH.handover)}–${at(ROHITH.stevenageEnd)}  ${hours(
      ROHITH.handover,
      ROHITH.stevenageEnd,
    )}h  ${ROHITH.stevenageDrops.short}sd ${ROHITH.stevenageDrops.long}ld ${ROHITH.stevenageDrops.extraShort}ms ${ROHITH.stevenageDrops.extraLong}ml`,
  );
  console.log(
    `    total  ${(
      Number(hours(ROHITH.hitchinStart, ROHITH.handover)) +
      Number(hours(ROHITH.handover, ROHITH.stevenageEnd))
    ).toFixed(2)}h, ${ROHITH.reapprove ? "re-approved per shift" : "left pending"}`,
  );
  console.log(`\n  ${PAVAN.label}`);
  console.log(
    `    #2     Stevenage  16:54–${at(PAVAN.stevenageEnd)}  ${hours(
      "2026-09-25T16:54:27.539+01:00",
      PAVAN.stevenageEnd,
    )}h  (was 0.09h)  ${PAVAN.stevenageDrops.short}sd ${PAVAN.stevenageDrops.long}ld`,
  );
  console.log(`    #1 Hitchin 11:56–16:54 unchanged, day left pending for sign-off`);

  if (!APPLY) {
    console.log(
      "\nNothing written. Confirm every time and count in the CONFIG block, then re-run with --apply.",
    );
    return;
  }

  const by = await actorId();
  await repairRohith(by);
  await reroll(ROHITH.employeeId, ROHITH.eventDate, by);
  await repairPavan(by);
  await reroll(PAVAN.employeeId, PAVAN.eventDate, by);

  console.log("\nAFTER");
  await showDay(ROHITH.label, ROHITH.eventId);
  await showDay(PAVAN.label, PAVAN.eventId);
  console.log(
    "\nDone. Pavan's day is PENDING — approve both shifts on Daily Approval so Stevenage's" +
      "\nhours reach the Tuesday payout. Regenerate any draft payout covering these weeks;" +
      "\na CONFIRMED one must be unlocked by a Super Admin, regenerated and re-confirmed.",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
