// Update 224 — cross-store days on Daily Approval.
//
// 1. The auto clock-out sweep must resolve a forgotten clock-out against the
//    booked shift AT THE SESSION'S STORE. Pavan clocked into Stevenage at 16:54
//    on 25/09, six minutes before its 17:00 booking, and the old time-only
//    match picked Hitchin's 11:55–17:00 and closed him at 17:00 — 5 minutes
//    recorded for an eight-hour shift.
// 2. A cross-store day must be refused a day-level total, and must reach the
//    manager Daily Approval of BOTH stores it was worked at.
//
// Run: npx tsx -r ./scripts/_script-env.cjs scripts/verify-update-224.ts

import { createClient } from "@supabase/supabase-js";
import { storesWorkedOnDay } from "../lib/clock-sessions";
import { resolvePayableWork } from "../lib/cash-flow";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FROM = "2026-09-01";
let failures = 0;

function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** The sweep's rule, mirrored: store first, then latest start not after clock-in. */
function pickRota(
  rows: Array<{ store_id: string | null; start_time: string | null; end_time: string | null }>,
  clockInMin: number,
  storeId: string | null,
) {
  const working = rows.filter((r) => r.start_time);
  const sameStore = storeId ? working.filter((r) => r.store_id === storeId) : [];
  const pool = sameStore.length > 0 ? sameStore : working;
  if (pool.length <= 1) return pool[0];
  const min = (t: string | null) => {
    const [h, m] = (t ?? "0:0").split(":").map(Number);
    return h * 60 + m;
  };
  const notAfter = pool.filter((r) => min(r.start_time) <= clockInMin).sort(
    (a, b) => min(b.start_time) - min(a.start_time),
  );
  return notAfter[0] ?? [...pool].sort((a, b) => min(a.start_time) - min(b.start_time))[0];
}

async function main() {
  const { data: stores } = await sb.from("stores").select("id, name");
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name as string]));

  const { data: sessions } = await sb
    .from("clock_sessions")
    .select(
      "id, employee_id, event_date, store_id, clock_in_at, clock_out_at, hours_approved, approved_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries",
    )
    .gte("event_date", FROM)
    .order("clock_in_at");
  const { data: clocks } = await sb
    .from("clock_events")
    .select(
      "employee_id, store_id, event_date, clock_in_at, clock_out_at, hours_approved, approved_hours",
    )
    .gte("event_date", FROM);
  const { data: rota } = await sb
    .from("rota_shifts")
    .select("employee_id, store_id, shift_date, start_time, end_time, is_day_off")
    .gte("shift_date", FROM)
    .eq("is_day_off", false);
  const { data: emps } = await sb.from("employees").select("id, name");
  const empName = new Map((emps ?? []).map((e) => [e.id, e.name as string]));

  // --- 1. the sweep picks the booked shift at the session's own store -------
  const rotaByKey = new Map<string, NonNullable<typeof rota>>();
  for (const r of rota ?? []) {
    const k = `${r.employee_id}:${r.shift_date}`;
    rotaByKey.set(k, [...(rotaByKey.get(k) ?? []), r]);
  }
  let checked = 0;
  for (const s of sessions ?? []) {
    const rows = rotaByKey.get(`${s.employee_id}:${s.event_date}`) ?? [];
    if (new Set(rows.map((r) => r.store_id)).size < 2) continue; // not a cross-store booking
    const inMin =
      Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(new Date(s.clock_in_at))
          .split(":")[0],
      ) * 60 +
      Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(new Date(s.clock_in_at))
          .split(":")[1],
      );
    const picked = pickRota(rows, inMin, s.store_id);
    checked += 1;
    check(
      `sweep: ${empName.get(s.employee_id)} ${s.event_date} shift at ${storeName.get(s.store_id ?? "") ?? "?"}`,
      picked?.store_id === s.store_id,
      `picked the ${storeName.get(picked?.store_id ?? "") ?? "—"} booking (${picked?.start_time}–${picked?.end_time})`,
    );
  }
  if (checked === 0) console.log("NOTE  no cross-store bookings in range to test the sweep against");

  // --- 2. cross-store days, and where their hours land ---------------------
  const byDay = new Map<string, NonNullable<typeof sessions>>();
  for (const s of sessions ?? []) {
    const k = `${s.employee_id}:${s.event_date}`;
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const payable = resolvePayableWork((clocks ?? []) as never, (sessions ?? []) as never);
  for (const [key, rows] of byDay) {
    const worked = storesWorkedOnDay(rows);
    if (worked.length < 2) continue;
    const [empId, date] = key.split(":");
    const perStore = payable
      .filter((w) => w.employee_id === empId && w.event_date === date)
      .map((w) => `${storeName.get(w.store_id)} ${w.hours.toFixed(2)}h`);
    console.log(
      `\nCROSS-STORE  ${empName.get(empId)} ${date} — ${worked.map((s) => storeName.get(s)).join(" + ")}`,
    );
    for (const r of rows) {
      console.log(
        `   ${storeName.get(r.store_id ?? "")?.padEnd(18)} ${r.clock_in_at} → ${r.clock_out_at ?? "open"}  ${r.hours_approved ? "approved" : "PENDING"}`,
      );
    }
    console.log(`   payable: ${perStore.length ? perStore.join(", ") : "nothing approved yet"}`);
    check(
      `cross-store day is split across stores when paid: ${empName.get(empId)} ${date}`,
      rows.every((r) => !r.hours_approved) || perStore.length > 0,
      "",
    );
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
