// =============================================================
// Login-credential helpers.
//
// Managers and employees do NOT use real emails to sign in — the admin
// provisions them and shares a generated username + password. Under the hood
// each username is mapped to a synthetic email so it works with Supabase
// email/password auth.
//
// This module is intentionally PURE (no Node/Supabase imports) so it is safe to
// import from both client components (login forms) and server actions.
// =============================================================

/** Synthetic email domain backing username logins. Not a real mailbox. */
export const CREDENTIAL_EMAIL_DOMAIN = "staff.peckers-app.co.uk";

/** Turn a person's name into a username stem, e.g. "Pavan Kumar" -> "pavan.kumar". */
export function usernameStemFromName(name: string): string {
  const stem = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
  return stem || "user";
}

/** Build the synthetic login email for a username. Deterministic. */
export function buildLoginEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${CREDENTIAL_EMAIL_DOMAIN}`;
}

/** True if the string looks like one of our synthetic credential emails. */
export function isCredentialEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${CREDENTIAL_EMAIL_DOMAIN}`);
}

/** Recover the username from a synthetic login email. */
export function usernameFromLoginEmail(email: string): string {
  return email.toLowerCase().replace(`@${CREDENTIAL_EMAIL_DOMAIN}`, "");
}

/**
 * Minimum length for a user-chosen password. Lives here (not in
 * lib/password-reset.ts, which imports node:crypto and so can never reach a
 * client bundle) because the login/reset forms validate against it too.
 */
export const MIN_PASSWORD_LENGTH = 8;

// ---- contact email (password reset) ----
//
// A CONTACT email is the staff member's real mailbox, stored in
// allowed_users.contact_email and used only to send password-reset links. It is
// never a login identity — managers and crew still sign in with their username.

/** Trim + lowercase an address so lookups and the unique index agree. */
export function normalizeContactEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Loose but useful address check: one @, something either side, a dotted TLD,
 * no spaces. Deliberately not RFC-complete — the real proof an address works is
 * that the reset mail arrives.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeContactEmail(email));
}

/**
 * Validate an address for use as a contact email, returning an error message or
 * null. Rejects our synthetic login domain: a reset mail sent there would go
 * nowhere, and letting one be stored would silently break the recovery flow it
 * exists to enable.
 */
export function validateContactEmail(email: string): string | null {
  const value = normalizeContactEmail(email);
  if (!value) return "Email is required";
  if (!isValidEmail(value)) return "Enter a valid email address";
  if (isCredentialEmail(value)) {
    return "That's a system login address, not a real mailbox. Use a personal or work email.";
  }
  return null;
}
