// =============================================================
// Scheduled reminder: clock in / clock out.
//
// Employees forget to clock in when they arrive and to clock out when they
// leave. This endpoint pushes a browser reminder at each employee's scheduled
// shift START (if they haven't clocked in) and shift END (if they clocked in
// but not out) — to every device they've opted in from.
//
// Triggered by an external scheduler (cron-job.org or GitHub Actions) every few
// minutes — NOT Vercel cron. Run it every ~5 minutes; the WINDOW constants below
// absorb scheduler jitter, and a per-day send log (push_reminders) guarantees
// each reminder goes out at most once.
//
// Auth: send the shared secret as `Authorization: Bearer <CRON_SECRET>`
// (or `?secret=<CRON_SECRET>`). Returns 401 otherwise.
//
// Env:
//   CRON_SECRET                   — shared secret guarding this endpoint
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — VAPID public key
//   VAPID_PRIVATE_KEY             — VAPID private key
//   SUPABASE_SERVICE_ROLE_KEY     — required (reads schedules, sends push)
// =============================================================

import { NextResponse } from "next/server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { isPushConfigured, sendPushToEmployee, type PushPayload } from "@/lib/push";
import { parseISODate, timeToMinutes, weekdayIndex } from "@/lib/utils";
import type { ReminderType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// How wide a window (minutes after the target time) still counts as "now", so a
// reminder is never missed just because the scheduler fired a few minutes late,
// and never sent hours stale if the scheduler was down.
const CLOCK_IN_LEAD_MIN = 0; // send exactly at shift start
const CLOCK_IN_WINDOW_MIN = 30; // …up to 30 min after
const CLOCK_OUT_WINDOW_MIN = 45; // people clock out a bit after the end

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Europe/London calendar date (YYYY-MM-DD) and minutes-since-midnight for a
 * given instant. Shift times are stored as UK wall-clock time-of-day; the server
 * runs in UTC, so both the date and the time-of-day must be derived in London.
 */
function londonNow(d: Date): { dateIso: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const dateIso = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return { dateIso, minutes };
}

type EffShift = { start: string; end: string | null; storeId: string | null };

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured() || !isProvisioningConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Push not configured (VAPID keys / service role key)." },
      { status: 200 },
    );
  }

  const admin = createAdminClient();
  const { dateIso, minutes: nowMin } = londonNow(new Date());
  const weekday = weekdayIndex(parseISODate(dateIso)); // 0=Mon..6=Sun

  // Only bother with employees who have at least one subscribed device.
  const { data: subRows } = await admin
    .from("push_subscriptions")
    .select("employee_id");
  const employeeIds = Array.from(new Set((subRows ?? []).map((r) => r.employee_id)));
  if (employeeIds.length === 0) {
    return NextResponse.json({ ok: true, subscribed: 0, sent: 0 });
  }

  const [employeesRes, rotaRes, schedRes, clocksRes, storesRes] = await Promise.all([
    admin
      .from("employees")
      .select("id, name, store_id, employment_status")
      .in("id", employeeIds),
    admin
      .from("rota_shifts")
      .select("employee_id, start_time, end_time, is_day_off, store_id")
      .eq("shift_date", dateIso)
      .in("employee_id", employeeIds),
    admin
      .from("employee_schedules")
      .select("employee_id, is_working, start_time, end_time")
      .eq("weekday", weekday)
      .in("employee_id", employeeIds),
    admin
      .from("clock_events")
      .select("employee_id, clock_in_at, clock_out_at")
      .eq("event_date", dateIso)
      .in("employee_id", employeeIds),
    admin.from("stores").select("id, name"),
  ]);

  const storeName = new Map((storesRes.data ?? []).map((s) => [s.id, s.name as string]));
  // First rota row / schedule row per employee (one shift per day in practice).
  const rotaByEmp = new Map<string, NonNullable<typeof rotaRes.data>[number]>();
  for (const r of rotaRes.data ?? []) if (!rotaByEmp.has(r.employee_id)) rotaByEmp.set(r.employee_id, r);
  const schedByEmp = new Map<string, NonNullable<typeof schedRes.data>[number]>();
  for (const s of schedRes.data ?? []) if (!schedByEmp.has(s.employee_id)) schedByEmp.set(s.employee_id, s);
  const clockByEmp = new Map<string, NonNullable<typeof clocksRes.data>[number]>();
  for (const c of clocksRes.data ?? []) if (!clockByEmp.has(c.employee_id)) clockByEmp.set(c.employee_id, c);

  // Effective shift for today: published rota row first, else the recurring
  // weekly template. Mirrors the crew screen's effFor().
  function effFor(empId: string, homeStoreId: string | null): EffShift | null {
    const real = rotaByEmp.get(empId);
    if (real) {
      if (real.is_day_off || !real.start_time) return null;
      return { start: real.start_time, end: real.end_time, storeId: real.store_id ?? homeStoreId };
    }
    const tmpl = schedByEmp.get(empId);
    if (tmpl && tmpl.is_working && tmpl.start_time) {
      return { start: tmpl.start_time, end: tmpl.end_time, storeId: homeStoreId };
    }
    return null;
  }

  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

  let sent = 0;
  let skipped = 0;
  const detail: Array<{ employee: string; type: ReminderType; delivered: number }> = [];

  for (const emp of employeesRes.data ?? []) {
    if (emp.employment_status === "left" || emp.employment_status === "inactive") continue;

    const eff = effFor(emp.id, emp.store_id ?? null);
    if (!eff) continue;

    const startMin = timeToMinutes(eff.start);
    const clk = clockByEmp.get(emp.id);
    const clockedIn = !!clk?.clock_in_at;
    const clockedOut = !!clk?.clock_out_at;
    const store = eff.storeId ? storeName.get(eff.storeId) ?? null : null;

    const candidates: Array<{ type: ReminderType; payload: PushPayload }> = [];

    // Clock-in reminder: at shift start, if not already clocked in.
    if (
      !clockedIn &&
      nowMin >= startMin - CLOCK_IN_LEAD_MIN &&
      nowMin <= startMin + CLOCK_IN_WINDOW_MIN
    ) {
      candidates.push({
        type: "clock_in",
        payload: {
          title: "Time to clock in 🕐",
          body: `Your ${hhmm(eff.start)} shift${store ? ` at ${store}` : ""} is starting — don't forget to clock in.`,
          url: "/employee/attendance",
          tag: `clockin-${dateIso}`,
        },
      });
    }

    // Clock-out reminder: at shift end, if clocked in but not out. Same-day
    // shifts only (skip overnight, where end <= start).
    if (eff.end) {
      const endMin = timeToMinutes(eff.end);
      if (
        endMin > startMin &&
        clockedIn &&
        !clockedOut &&
        nowMin >= endMin &&
        nowMin <= endMin + CLOCK_OUT_WINDOW_MIN
      ) {
        candidates.push({
          type: "clock_out",
          payload: {
            title: "Time to clock out 👋",
            body: `Your shift${store ? ` at ${store}` : ""} ended at ${hhmm(eff.end)} — remember to clock out.`,
            url: "/employee/attendance",
            tag: `clockout-${dateIso}`,
          },
        });
      }
    }

    for (const c of candidates) {
      // Claim the send first: insert the once-per-day log row. If it already
      // exists (a previous run sent it), the insert is ignored and we skip —
      // this is what stops the reminder repeating on every 5-minute run.
      const { data: inserted, error } = await admin
        .from("push_reminders")
        .upsert(
          {
            employee_id: emp.id,
            reminder_date: dateIso,
            reminder_type: c.type,
            store_id: eff.storeId,
          },
          { onConflict: "employee_id,reminder_date,reminder_type", ignoreDuplicates: true },
        )
        .select("id");

      if (error) {
        console.error("[shift-reminders] claim failed:", error.message);
        continue;
      }
      if (!inserted || inserted.length === 0) {
        skipped += 1; // already sent today
        continue;
      }

      const delivered = await sendPushToEmployee(admin, emp.id, c.payload);
      sent += 1;
      detail.push({ employee: emp.name, type: c.type, delivered });
    }
  }

  return NextResponse.json({
    ok: true,
    at: `${dateIso} ${Math.floor(nowMin / 60)}:${String(nowMin % 60).padStart(2, "0")} UK`,
    subscribed: employeeIds.length,
    sent,
    skipped,
    detail,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
