// =============================================================
// Scheduled sweep: close the days people forgot to clock out of.
//
// A missed clock-out used to erase the whole day — every hours calculation
// needs both timestamps, so the person showed 0.00h on the Tuesday sheet and
// the day never reached the approval queue. This endpoint closes any open row
// from a day that has already finished, using the scheduled shift end as the
// clock-out time, and flags it (auto_clocked_out) so a manager can correct it
// while approving hours. See lib/auto-clock-out.ts for the rules.
//
// Safe to call as often as you like: it only ever touches rows that are still
// open, only for days before today, and only after a grace period past the
// assumed end. Running it once a day (any time after ~04:00 UK) is enough; the
// shift-reminders cron also calls it, so a single scheduler entry covers both.
//
// Auth: send the shared secret as `Authorization: Bearer <CRON_SECRET>`
// (or `?secret=<CRON_SECRET>`). Returns 401 otherwise.
//
// Env:
//   CRON_SECRET                — shared secret guarding this endpoint
//   SUPABASE_SERVICE_ROLE_KEY  — required (writes other people's clock rows)
// =============================================================

import { NextResponse } from "next/server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { autoCloseOpenClocks, londonDateISO } from "@/lib/auto-clock-out";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isProvisioningConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Service role key not configured." },
      { status: 200 },
    );
  }

  const now = new Date();
  const result = await autoCloseOpenClocks(createAdminClient(), { now });

  return NextResponse.json({
    ok: result.ok,
    today: londonDateISO(now),
    scanned: result.scanned,
    closed: result.closed.length,
    waiting: result.waiting,
    detail: result.closed,
    ...(result.error ? { error: result.error } : {}),
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
