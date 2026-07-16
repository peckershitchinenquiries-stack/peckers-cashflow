// =============================================================
// Password-reset tokens + email template (server-only).
//
// Imports node:crypto, so this module can never be pulled into a client bundle.
// The actual flow lives in app/actions/password-reset.ts; this file is the pure
// token/format layer so the rules (TTL, hashing, rate limit) sit in one place.
// =============================================================

import { createHash, randomBytes } from "crypto";

export { MIN_PASSWORD_LENGTH } from "./credentials";

/** How long a reset link stays usable. Short: it's emailed in plaintext. */
export const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Max reset emails per account per hour. Stops someone mail-bombing a colleague
 * by hammering the form with their address; the legitimate user needs one.
 */
export const MAX_RESET_REQUESTS_PER_HOUR = 3;

/**
 * A fresh 256-bit token. base64url so it survives a URL path segment untouched
 * — no percent-encoding to mangle when a mail client rewrites the link.
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash a token for storage/lookup. Only the hash is ever persisted, so a dump of
 * password_reset_tokens yields nothing replayable.
 *
 * Plain sha256 (not bcrypt) is right here: the input is 256 bits of CSPRNG
 * output, not a human-chosen password, so there is no dictionary to grind and
 * nothing for a slow KDF to buy.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** When a token minted now should expire. */
export function resetTokenExpiry(): Date {
  return new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

/**
 * Absolute base URL for links in outbound mail. Read ONLY from APP_URL — never
 * from the request.
 *
 * Deriving it from Host / X-Forwarded-Host (the obvious "just use the origin"
 * fallback) is the classic password-reset host-poisoning bug: those headers are
 * attacker-supplied, and Next's server-action origin check compares
 * `origin` against `x-forwarded-host ?? host` — i.e. two attacker-controlled
 * values against each other — so it does not save us. The victim would receive a
 * genuine email, from the real sender, carrying a live token pointed at the
 * attacker's host.
 *
 * Returns null when unset, which makes the reset flow fail closed and say so.
 */
export function resolveAppUrl(): string | null {
  const configured = process.env.APP_URL?.trim();
  if (!configured) return null;
  return configured.replace(/\/+$/, "");
}

/** The link we email. Token rides in the path, never a query string. */
export function buildResetUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/reset-password/${token}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The reset email. Names the account's username so someone with several logins
 * (or who forgot which portal they're on) knows exactly what this link resets.
 */
export function buildResetEmail(input: {
  name: string | null;
  username: string | null;
  resetUrl: string;
  portalLabel: string;
}): { subject: string; html: string; text: string } {
  const greeting = input.name?.trim() ? `Hi ${escapeHtml(input.name.trim())},` : "Hi,";
  const identity = input.username
    ? `<p style="color:#555;font-size:14px;margin:0 0 16px;">Account: <strong style="font-family:monospace;">${escapeHtml(
        input.username,
      )}</strong> (${escapeHtml(input.portalLabel)} portal)</p>`
    : "";
  const url = escapeHtml(input.resetUrl);

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;">` +
    `<h2 style="margin:0 0 12px;">Reset your Peckers password</h2>` +
    `<p style="margin:0 0 12px;font-size:15px;">${greeting}</p>` +
    `<p style="margin:0 0 16px;font-size:15px;color:#333;">` +
    `We got a request to reset your password. Click the button below to choose a new one. ` +
    `This link works once and expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>` +
    identity +
    `<p style="margin:0 0 24px;">` +
    `<a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;` +
    `padding:12px 22px;border-radius:8px;font-weight:bold;font-size:15px;">Set a new password</a></p>` +
    `<p style="margin:0 0 8px;font-size:13px;color:#666;">Or paste this into your browser:</p>` +
    `<p style="margin:0 0 24px;font-size:12px;color:#666;word-break:break-all;">${url}</p>` +
    `<p style="margin:0;font-size:13px;color:#666;border-top:1px solid #eee;padding-top:16px;">` +
    `Didn't ask for this? Ignore this email — your password stays as it is.</p>` +
    `</div>`;

  const text =
    `${input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,"}\n\n` +
    `We got a request to reset your Peckers password. Open this link to choose a new one ` +
    `(it works once and expires in ${RESET_TOKEN_TTL_MINUTES} minutes):\n\n` +
    `${input.resetUrl}\n\n` +
    (input.username ? `Account: ${input.username} (${input.portalLabel} portal)\n\n` : "") +
    `Didn't ask for this? Ignore this email — your password stays as it is.`;

  return { subject: "Reset your Peckers password", html, text };
}
