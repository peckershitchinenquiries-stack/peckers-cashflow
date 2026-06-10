// =============================================================
// Scheduled reminder: missing daily cash entry.
//
// Triggered by an external scheduler (GitHub Actions or cron-job.org) — NOT
// Vercel cron. If a manager forgot to record yesterday's cash entry for a
// store, this emails Rishi a reminder. Intended to run ~3pm the next day.
//
// Auth: send the shared secret as `Authorization: Bearer <CRON_SECRET>`
// (or `?secret=<CRON_SECRET>`). Returns 401 otherwise.
//
// Env:
//   CRON_SECRET        — shared secret guarding this endpoint
//   REMINDER_EMAIL     — who to email (Rishi). Falls back to ALERT_EMAIL_TO.
//   RESEND_API_KEY     — required to actually send (see lib/email.ts)
// =============================================================

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { addDays, formatDDMMYYYY, toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  const supabase = createAdminClient();
  // The day that should already have been logged: yesterday.
  const yesterday = toISODate(addDays(new Date(), -1));

  const [{ data: stores }, { data: entries }] = await Promise.all([
    supabase.from("stores").select("id, name"),
    supabase.from("daily_cash_entries").select("store_id").eq("entry_date", yesterday),
  ]);

  const loggedStoreIds = new Set((entries ?? []).map((e) => e.store_id));
  const missing = (stores ?? []).filter((s) => !loggedStoreIds.has(s.id));

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, missing: 0, emailed: false });
  }

  const recipients = [process.env.REMINDER_EMAIL, process.env.ALERT_EMAIL_TO].filter(
    (x): x is string => Boolean(x),
  );

  const list = missing.map((s) => `<li>${s.name}</li>`).join("");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">` +
    `<h2 style="margin:0 0 8px;">Missing cash entry — ${formatDDMMYYYY(yesterday)}</h2>` +
    `<p style="color:#555;font-size:14px;margin:0 0 12px;">` +
    `The following store${missing.length === 1 ? "" : "s"} did not record a daily cash entry yesterday:</p>` +
    `<ul>${list}</ul>` +
    `<p style="color:#888;font-size:12px;">Please follow up with the manager.</p>` +
    `</div>`;
  const text =
    `Missing cash entry for ${formatDDMMYYYY(yesterday)}:\n` +
    missing.map((s) => `- ${s.name}`).join("\n");

  const result = await sendEmail({
    recipients,
    subject: `Peckers: missing cash entry for ${formatDDMMYYYY(yesterday)}`,
    html,
    text,
  });

  return NextResponse.json({
    ok: true,
    missing: missing.length,
    stores: missing.map((s) => s.name),
    emailed: result.sent,
    reason: result.reason,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
