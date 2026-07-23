// =============================================================
// Scheduled reminder: clock in / clock out.
//
// Staff forget to clock in when they arrive and to clock out when they leave.
// This endpoint pushes a browser reminder at each person's scheduled shift
// START (if not clocked in) and shift END (if clocked in but not out) — to
// every device they've opted in from. Covers both employees (rota_shifts /
// employee_schedules) and managers (manager_shifts).
//
// Triggered by an external scheduler (cron-job.org or GitHub Actions) every few
// minutes — NOT Vercel cron. Intended cadence is every 5 minutes, but GitHub
// Actions' `schedule` trigger does NOT guarantee that: in production this has
// been observed firing on average every ~100 minutes (occasionally 3+ hours
// apart), never faster than ~50 minutes. The WINDOW constants below are sized
// to survive that — wide enough that a late-firing run still catches a shift
// change before its window closes — and the per-day send log (push_reminders /
// manager_push_reminders) guarantees each reminder still only goes out once.
// For tighter timing, point cron-job.org at this URL instead (see repo docs).
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
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import {
  isPushConfigured,
  sendPushToEmployee,
  sendPushToManager,
  type PushPayload,
} from "@/lib/push";
import { parseISODate, timeToMinutes, weekdayIndex } from "@/lib/utils";
import { autoCloseOpenClocks } from "@/lib/auto-clock-out";
import type { ReminderType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Clock-out reminder stays live for this long after shift end. 240 min (4h)
// comfortably covers the worst observed GitHub Actions gap (~190 min) with
// margin, without nagging someone the next morning about yesterday's shift.
const CLOCK_OUT_WINDOW_MIN = 240;
// Fallback clock-in upper bound when a shift has no end time recorded — the
// normal case bounds it by the shift's own end instead (see effUpperBound).
const CLOCK_IN_FALLBACK_WINDOW_MIN = 300;

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
type SendResult = { sent: number; skipped: number; detail: Array<{ name: string; type: ReminderType; delivered: number }> };

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

/**
 * Decide which reminders (if any) are due for one person right now, claim each
 * via the per-day send log (so a duplicate cron run is a no-op), and deliver.
 * Shared between the employee and manager loops below — only the subscription
 * table / send function / dedup table differ.
 */
async function maybeRemind(opts: {
  admin: SupabaseClient;
  kind: "employee" | "manager";
  id: string;
  name: string;
  eff: EffShift;
  clockedIn: boolean;
  clockedOut: boolean;
  storeName: string | null;
  dateIso: string;
  nowMin: number;
  remindersTable: "push_reminders" | "manager_push_reminders";
  idColumn: "employee_id" | "manager_id";
  clockHref: string;
  send: (admin: SupabaseClient, id: string, payload: PushPayload) => Promise<number>;
}): Promise<SendResult> {
  const { admin, id, name, eff, clockedIn, clockedOut, storeName, dateIso, nowMin } = opts;
  const startMin = timeToMinutes(eff.start);
  const endMin = eff.end ? timeToMinutes(eff.end) : null;

  const candidates: Array<{ type: ReminderType; payload: PushPayload }> = [];

  // Clock-in reminder: from shift start until shift end (or a generous fallback
  // if no end time is set) — as long as they still haven't clocked in. No
  // narrow window: the send log below guarantees it fires at most once, so
  // widening this just means a late-arriving cron run still catches it.
  const clockInUpperBound = endMin ?? startMin + CLOCK_IN_FALLBACK_WINDOW_MIN;
  if (!clockedIn && nowMin >= startMin && nowMin <= clockInUpperBound) {
    candidates.push({
      type: "clock_in",
      payload: {
        title: "Time to clock in 🕐",
        body: `Your ${hhmm(eff.start)} shift${storeName ? ` at ${storeName}` : ""} is starting — don't forget to clock in.`,
        url: opts.clockHref,
        tag: `clockin-${dateIso}`,
      },
    });
  }

  // Clock-out reminder: at shift end, if clocked in but not out. Same-day
  // shifts only (skip overnight, where end <= start).
  if (endMin != null && endMin > startMin && clockedIn && !clockedOut) {
    if (nowMin >= endMin && nowMin <= endMin + CLOCK_OUT_WINDOW_MIN) {
      candidates.push({
        type: "clock_out",
        payload: {
          title: "Time to clock out 👋",
          body: `Your shift${storeName ? ` at ${storeName}` : ""} ended at ${hhmm(eff.end)} — remember to clock out.`,
          url: opts.clockHref,
          tag: `clockout-${dateIso}`,
        },
      });
    }
  }

  const result: SendResult = { sent: 0, skipped: 0, detail: [] };

  for (const c of candidates) {
    // Claim the send first: insert the once-per-day log row. If it already
    // exists (a previous run sent it), the insert is ignored and we skip —
    // this is what stops the reminder repeating on every cron run.
    const { data: inserted, error } = await admin
      .from(opts.remindersTable)
      .upsert(
        {
          [opts.idColumn]: id,
          reminder_date: dateIso,
          reminder_type: c.type,
          store_id: eff.storeId,
        },
        { onConflict: `${opts.idColumn},reminder_date,reminder_type`, ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      console.error(`[shift-reminders] claim failed (${opts.kind}):`, error.message);
      continue;
    }
    if (!inserted || inserted.length === 0) {
      result.skipped += 1; // already sent today
      continue;
    }

    const delivered = await opts.send(admin, id, c.payload);
    result.sent += 1;
    result.detail.push({ name, type: c.type, delivered });
  }

  return result;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Piggyback the auto clock-out sweep on this schedule so one scheduler entry
  // covers both. It's independent of push (it needs only the service-role key),
  // so it runs BEFORE the VAPID check below — a site with no push keys still
  // gets its forgotten clock-outs closed. See lib/auto-clock-out.ts.
  let autoClosed = 0;
  if (isProvisioningConfigured()) {
    const sweep = await autoCloseOpenClocks(createAdminClient());
    autoClosed = sweep.closed.length;
  }

  if (!isPushConfigured() || !isProvisioningConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Push not configured (VAPID keys / service role key).",
        autoClosed,
      },
      { status: 200 },
    );
  }

  const admin = createAdminClient();
  const { dateIso, minutes: nowMin } = londonNow(new Date());
  const weekday = weekdayIndex(parseISODate(dateIso)); // 0=Mon..6=Sun

  const [empSubRows, mgrSubRows, storesRes] = await Promise.all([
    admin.from("push_subscriptions").select("employee_id"),
    admin.from("manager_push_subscriptions").select("manager_id"),
    admin.from("stores").select("id, name"),
  ]);
  const employeeIds = Array.from(new Set((empSubRows.data ?? []).map((r) => r.employee_id)));
  const managerIds = Array.from(new Set((mgrSubRows.data ?? []).map((r) => r.manager_id)));
  const storeName = new Map((storesRes.data ?? []).map((s) => [s.id, s.name as string]));

  let sent = 0;
  let skipped = 0;
  const detail: Array<{ name: string; type: ReminderType; delivered: number }> = [];

  // ---------------- Employees ----------------
  if (employeeIds.length > 0) {
    const [employeesRes, rotaRes, schedRes, clocksRes] = await Promise.all([
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
    ]);

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

    for (const emp of employeesRes.data ?? []) {
      if (emp.employment_status === "left" || emp.employment_status === "inactive") continue;
      const eff = effFor(emp.id, emp.store_id ?? null);
      if (!eff) continue;
      const clk = clockByEmp.get(emp.id);

      const r = await maybeRemind({
        admin,
        kind: "employee",
        id: emp.id,
        name: emp.name,
        eff,
        clockedIn: !!clk?.clock_in_at,
        clockedOut: !!clk?.clock_out_at,
        storeName: eff.storeId ? storeName.get(eff.storeId) ?? null : null,
        dateIso,
        nowMin,
        remindersTable: "push_reminders",
        idColumn: "employee_id",
        clockHref: "/employee/attendance",
        send: sendPushToEmployee,
      });
      sent += r.sent;
      skipped += r.skipped;
      detail.push(...r.detail);
    }
  }

  // ---------------- Managers ----------------
  if (managerIds.length > 0) {
    const [managersRes, mgrShiftsRes, mgrClocksRes] = await Promise.all([
      admin.from("allowed_users").select("id, name, email, role").in("id", managerIds),
      admin
        .from("manager_shifts")
        .select("manager_id, start_time, end_time, is_day_off, store_id")
        .eq("shift_date", dateIso)
        .in("manager_id", managerIds),
      admin
        .from("manager_clock_events")
        .select("manager_id, clock_in_at, clock_out_at")
        .eq("event_date", dateIso)
        .in("manager_id", managerIds),
    ]);

    const shiftByMgr = new Map((mgrShiftsRes.data ?? []).map((s) => [s.manager_id, s]));
    const clockByMgr = new Map((mgrClocksRes.data ?? []).map((c) => [c.manager_id, c]));

    for (const mgr of managersRes.data ?? []) {
      // Only current managers — a demoted/removed login shouldn't still get pushed.
      if (mgr.role !== "manager") continue;
      const shift = shiftByMgr.get(mgr.id);
      if (!shift || shift.is_day_off || !shift.start_time) continue;
      const eff: EffShift = { start: shift.start_time, end: shift.end_time, storeId: shift.store_id };
      const clk = clockByMgr.get(mgr.id);

      const r = await maybeRemind({
        admin,
        kind: "manager",
        id: mgr.id,
        name: mgr.name ?? mgr.email,
        eff,
        clockedIn: !!clk?.clock_in_at,
        clockedOut: !!clk?.clock_out_at,
        storeName: eff.storeId ? storeName.get(eff.storeId) ?? null : null,
        dateIso,
        nowMin,
        remindersTable: "manager_push_reminders",
        idColumn: "manager_id",
        clockHref: "/manager/live",
        send: sendPushToManager,
      });
      sent += r.sent;
      skipped += r.skipped;
      detail.push(...r.detail);
    }
  }

  return NextResponse.json({
    ok: true,
    at: `${dateIso} ${Math.floor(nowMin / 60)}:${String(nowMin % 60).padStart(2, "0")} UK`,
    subscribedEmployees: employeeIds.length,
    subscribedManagers: managerIds.length,
    sent,
    skipped,
    autoClosed,
    detail,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
