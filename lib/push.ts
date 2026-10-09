// =============================================================
// Server-side push delivery, across BOTH transports.
//
// Sends clock-in / clock-out reminder notifications to every device a person
// has opted in from (push_subscriptions / manager_push_subscriptions). Used by
// the reminder cron (app/api/cron/shift-reminders) and the "send test" server
// actions.
//
// A device is either a BROWSER (Web Push: endpoint + p256dh + auth, VAPID
// signed) or the ANDROID APP (an FCM registration token). Migration 067 put
// both in the same table behind a `platform` discriminator, so the two public
// functions below take the same arguments they always did and the split happens
// entirely inside sendPushToSubscribers. Callers do not know there are two
// transports.
//
// SERVER ONLY — imports `web-push` (Node crypto/https) and ./fcm
// (firebase-admin), and is always called with the service-role admin client.
// Never import from client code.
//
// Configuration (env):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — VAPID public key (also read by the client to
//                                   subscribe; safe to expose)
//   VAPID_PRIVATE_KEY             — VAPID private key (server secret)
//   VAPID_SUBJECT                 — contact URI for the push service, e.g.
//                                   "mailto:admin@peckers.co.uk" (optional)
//   FIREBASE_SERVICE_ACCOUNT      — native delivery; see ./fcm for the
//                                   alternative three-variable form
//
// The two transports are configured INDEPENDENTLY. A site with VAPID keys and
// no Firebase credential keeps serving every browser user exactly as before.
// =============================================================

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isFcmConfigured, sendFcmToTokens } from "./fcm";

export type PushPayload = {
  title: string;
  body: string;
  /** Where to send the employee when they tap the notification. */
  url?: string;
  /** Collapse key — a new notification with the same tag replaces the old one. */
  tag?: string;
};

/** True when the VAPID keypair is present, so WEB push can actually be sent. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

/** True when EITHER transport can deliver. What a reminder run should gate on. */
export function isAnyPushConfigured(): boolean {
  return isPushConfigured() || isFcmConfigured();
}

export { isFcmConfigured };

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

type SubscriptionTable = "push_subscriptions" | "manager_push_subscriptions";

type DeviceRow = {
  id: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  platform: string | null;
  native_token: string | null;
};

/** Remove subscription rows the push service has told us are gone for good. */
async function pruneDead(admin: SupabaseClient, table: SubscriptionTable, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) console.error("[push] pruning dead subscriptions failed:", error.message);
}

/** Web Push leg: VAPID-signed delivery to browsers and installed PWAs. */
async function sendWeb(
  admin: SupabaseClient,
  table: SubscriptionTable,
  rows: DeviceRow[],
  payload: PushPayload,
): Promise<number> {
  if (rows.length === 0) return 0;
  if (!isPushConfigured()) {
    console.error("[push] skipping", rows.length, "browser device(s): no VAPID keypair.");
    return 0;
  }
  ensureConfigured();

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let delivered = 0;

  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        body,
      );
      delivered += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // 404 Not Found / 410 Gone — the browser dropped this subscription.
      if (statusCode === 404 || statusCode === 410) {
        dead.push(sub.id);
      } else {
        console.error(
          "[push] web send failed:",
          statusCode ?? "",
          (err as { body?: string })?.body ?? (err instanceof Error ? err.message : err),
        );
      }
    }
  }

  await pruneDead(admin, table, dead);
  return delivered;
}

/** Native leg: FCM delivery to the Android app, which has no Push API at all. */
async function sendNative(
  admin: SupabaseClient,
  table: SubscriptionTable,
  rows: DeviceRow[],
  payload: PushPayload,
): Promise<number> {
  if (rows.length === 0) return 0;
  if (!isFcmConfigured()) {
    console.error(
      "[push] skipping",
      rows.length,
      "app device(s): no Firebase service account configured.",
    );
    return 0;
  }

  const idByToken = new Map(rows.map((r) => [r.native_token as string, r.id]));
  const results = await sendFcmToTokens([...idByToken.keys()], payload);

  const dead: string[] = [];
  let delivered = 0;
  for (const r of results) {
    if (r.ok) {
      delivered += 1;
      continue;
    }
    // FCM reports a gone device as an error CODE, not as HTTP 404/410 — so the
    // pruning condition cannot be shared with the web leg above, only the
    // pruning itself.
    if (r.dead) dead.push(idByToken.get(r.token) as string);
    else console.error("[push] native send failed:", r.error ?? "");
  }

  await pruneDead(admin, table, dead);
  return delivered;
}

const WEB_COLUMNS = "id, endpoint, p256dh, auth";
const ALL_COLUMNS = `${WEB_COLUMNS}, platform, native_token`;
// 42703 = undefined_column. Migration 067 adds `platform` and `native_token`;
// until it has run, asking for them is a 400 and would take EVERY reminder down
// with it, browsers included. So the read falls back to the pre-067 columns and
// treats the table as all-web, which is exactly what it is at that point. Means
// this can deploy before or after the migration — the ordering trap CLAUDE.md
// records from migration 027. Remove the fallback once 067 is applied.
const UNDEFINED_COLUMN = "42703";

/** This person's devices, or null if they could not be read at all. */
async function loadDevices(
  admin: SupabaseClient,
  table: SubscriptionTable,
  idColumn: "employee_id" | "manager_id",
  idValue: string,
): Promise<DeviceRow[] | null> {
  const { data, error } = await admin.from(table).select(ALL_COLUMNS).eq(idColumn, idValue);
  if (!error) return data as DeviceRow[];

  if (error.code === UNDEFINED_COLUMN) {
    console.warn(`[push] ${table} has no platform column yet — migration 067 has not run.`);
    const legacy = await admin.from(table).select(WEB_COLUMNS).eq(idColumn, idValue);
    if (legacy.error) {
      console.error(`[push] could not load ${table} for ${idValue}:`, legacy.error.message);
      return null;
    }
    return (legacy.data ?? []).map((r) => ({ ...r, platform: "web", native_token: null }));
  }

  // Logged, never swallowed: an unreadable subscription table looks exactly
  // like nobody being subscribed, and would stop every reminder in silence.
  console.error(`[push] could not load ${table} for ${idValue}:`, error.message);
  return null;
}

/**
 * Deliver a push to every device subscribed in `table`, filtered by
 * `idColumn = idValue` (e.g. push_subscriptions.employee_id, or
 * manager_push_subscriptions.manager_id), over whichever transport each device
 * needs. Dead subscriptions are pruned so they don't accumulate. Returns how
 * many devices actually accepted the notification.
 *
 * Best-effort by design: a failure to reach one device never throws — it's
 * logged and skipped — so a reminder run isn't derailed by one stale endpoint.
 * A failed QUERY, though, is logged rather than silently read as "nobody is
 * subscribed": that would stop every reminder with nothing in the logs.
 */
async function sendPushToSubscribers(
  admin: SupabaseClient,
  table: SubscriptionTable,
  idColumn: "employee_id" | "manager_id",
  idValue: string,
  payload: PushPayload,
): Promise<number> {
  const rows = await loadDevices(admin, table, idColumn, idValue);
  if (rows === null || rows.length === 0) return 0;
  // A row written before migration 067 has no platform; it is a browser, which
  // is what the default 'web' on the column says too.
  const web = rows.filter((r) => (r.platform ?? "web") === "web" && r.endpoint);
  const native = rows.filter((r) => (r.platform ?? "web") !== "web" && r.native_token);

  const [webDelivered, nativeDelivered] = await Promise.all([
    sendWeb(admin, table, web, payload),
    sendNative(admin, table, native, payload),
  ]);

  return webDelivered + nativeDelivered;
}

export function sendPushToEmployee(
  admin: SupabaseClient,
  employeeId: string,
  payload: PushPayload,
): Promise<number> {
  return sendPushToSubscribers(admin, "push_subscriptions", "employee_id", employeeId, payload);
}

export function sendPushToManager(
  admin: SupabaseClient,
  managerId: string,
  payload: PushPayload,
): Promise<number> {
  return sendPushToSubscribers(
    admin,
    "manager_push_subscriptions",
    "manager_id",
    managerId,
    payload,
  );
}
