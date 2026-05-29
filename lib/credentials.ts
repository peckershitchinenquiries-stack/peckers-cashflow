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
