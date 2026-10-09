// =============================================================
// Server-side Firebase Cloud Messaging delivery.
//
// The native transport behind lib/push.ts. An Android System WebView implements
// no Push API, so a device running the pms-mobile shell cannot produce a Web
// Push subscription at all — it registers an FCM token instead (migration 067).
// This module turns a PushPayload into an FCM message and reports, per token,
// whether the token is now dead so the caller can prune it.
//
// SERVER ONLY — imports firebase-admin (Node crypto, gRPC-free HTTP, service
// account signing). Never import from client code: lib/push.ts is its only
// caller, and that is server-only too.
//
// Configuration (env) — either form works:
//   FIREBASE_SERVICE_ACCOUNT   — the whole service-account JSON, raw or base64.
//                                One secret, which is what Vercel wants.
//   or the three fields separately:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY       — newlines may be escaped as \n
//
// This is a DIFFERENT credential from the shell's google-services.json: that
// file identifies the app to Firebase, this one identifies the server. Neither
// is ever committed.
// =============================================================

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { PushPayload } from "./push";

/** The one outcome lib/push.ts has to act on, per token. */
export type FcmSendResult = {
  token: string;
  ok: boolean;
  /** The token is no longer registered — the app was uninstalled or it rotated. */
  dead: boolean;
  error?: string;
};

type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

// Our own named app, so this never collides with a default app any other
// firebase-admin caller might initialise.
const APP_NAME = "peckers-push";

function decodeServiceAccountJson(raw: string): ServiceAccount | null {
  // Base64 is the practical way to get a multi-line PEM through a dashboard
  // env var intact, so accept either encoding.
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  try {
    const parsed = JSON.parse(text) as Record<string, string>;
    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const privateKey = parsed.private_key || parsed.privateKey;
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

function serviceAccount(): ServiceAccount | null {
  const blob = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (blob) return decodeServiceAccountJson(blob);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/** True when a service account is present, so native push can actually be sent. */
export function isFcmConfigured(): boolean {
  return serviceAccount() !== null;
}

let cachedApp: App | null = null;

function app(): App {
  if (cachedApp) return cachedApp;
  const sa = serviceAccount();
  if (!sa) {
    throw new Error(
      "Native push is not configured. Set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).",
    );
  }
  const existing = getApps().find((a) => a.name === APP_NAME);
  cachedApp =
    existing ??
    initializeApp(
      {
        credential: cert({
          projectId: sa.projectId,
          clientEmail: sa.clientEmail,
          // A PEM pasted into an env var arrives with its newlines escaped.
          privateKey: sa.privateKey.replace(/\\n/g, "\n"),
        }),
      },
      APP_NAME,
    );
  return cachedApp;
}

// Codes FCM uses for a token that will never deliver again. The web-push
// equivalents are HTTP 404/410; FCM reports it as an error code instead, which
// is why lib/push.ts cannot share one condition between the two transports.
//
// `messaging/invalid-argument` is deliberately NOT here although it can mean a
// malformed token: it is equally what a malformed message PAYLOAD returns, and
// a payload bug fails identically for every token in the batch — which under a
// broader rule would prune every real device at once. It is logged instead.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Deliver one payload to a set of FCM tokens, one result per token in the order
 * given.
 *
 * Both a `notification` block and a `data` block are sent, deliberately. The
 * notification block is what Android's system tray draws while the app is
 * backgrounded or killed — the only case a shift reminder actually matters. The
 * data block carries `url` through to the tap handler, because a notification
 * tapped from the tray reaches the WebView as a plugin event, not as a
 * navigation.
 *
 * Never throws for a delivery failure: a reminder run must not be derailed by
 * one stale handset, exactly as on the Web Push side.
 */
export async function sendFcmToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<FcmSendResult[]> {
  if (tokens.length === 0) return [];

  const data: Record<string, string> = { url: payload.url ?? "/" };
  if (payload.tag) data.tag = payload.tag;

  let response;
  try {
    response = await getMessaging(app()).sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data,
      android: {
        // Reminders are time-critical and must survive Doze; without this they
        // can be held until the next maintenance window, by which time the
        // shift has started.
        priority: "high",
        // Same collapse semantics as the Web Push `tag`: a second clock-in
        // reminder replaces the first rather than stacking.
        collapseKey: payload.tag,
        notification: { tag: payload.tag, defaultSound: true },
      },
    });
  } catch (err) {
    // A whole-batch failure: bad credentials, or the network. No token is
    // provably dead, so none is pruned.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[push] FCM batch send failed:", message);
    return tokens.map((token) => ({ token, ok: false, dead: false, error: message }));
  }

  return response.responses.map((r, i) => {
    if (r.success) return { token: tokens[i], ok: true, dead: false };
    const code = r.error?.code ?? "";
    return {
      token: tokens[i],
      ok: false,
      dead: DEAD_TOKEN_CODES.has(code),
      error: `${code} ${r.error?.message ?? ""}`.trim(),
    };
  });
}
