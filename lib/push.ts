// =============================================================
// Server-side Web Push delivery.
//
// Sends clock-in / clock-out reminder notifications to the browsers an employee
// has opted in from (push_subscriptions). Used by the reminder cron
// (app/api/cron/shift-reminders) and the "send test" server action.
//
// SERVER ONLY — imports `web-push` (Node crypto/https) and is always called with
// the service-role admin client. Never import from client code.
//
// Configuration (env):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — VAPID public key (also read by the client to
//                                   subscribe; safe to expose)
//   VAPID_PRIVATE_KEY             — VAPID private key (server secret)
//   VAPID_SUBJECT                 — contact URI for the push service, e.g.
//                                   "mailto:admin@peckers.co.uk" (optional)
// =============================================================

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushPayload = {
  title: string;
  body: string;
  /** Where to send the employee when they tap the notification. */
  url?: string;
  /** Collapse key — a new notification with the same tag replaces the old one. */
  tag?: string;
};

/** True when the VAPID keypair is present, so push can actually be sent. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

let vapidReady = false;
function ensureConfigured() {
  if (vapidReady) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error(
      "Web push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
  }
  const subject = process.env.VAPID_SUBJECT || "mailto:notifications@peckers.local";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
}

/**
 * Deliver a push to every device an employee has subscribed. Dead subscriptions
 * (the push service replies 404/410 = gone) are pruned so they don't accumulate.
 * Returns how many devices actually accepted the notification.
 *
 * Best-effort by design: a failure to reach one device never throws — it's
 * logged and skipped — so a reminder run isn't derailed by one stale endpoint.
 */
export async function sendPushToEmployee(
  admin: SupabaseClient,
  employeeId: string,
  payload: PushPayload,
): Promise<number> {
  ensureConfigured();

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("employee_id", employeeId);

  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      delivered += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // 404 Not Found / 410 Gone — the browser dropped this subscription.
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error(
          "[push] send failed:",
          statusCode ?? "",
          (err as { body?: string })?.body ?? (err instanceof Error ? err.message : err),
        );
      }
    }
  }

  return delivered;
}
