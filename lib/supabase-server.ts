import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { PORTAL_HOME, type AllowedUserRole } from "./types";

// Connect/read timeout for Supabase HTTP calls. Default undici timeout is 10s,
// which is long enough to make every transient blip feel like a full hang in
// dev. We also retry once on connect-timeout so cold TLS handshakes don't
// crash a page render.
const FETCH_TIMEOUT_MS = 6000;
const RETRY_ON_CONNECT_ERR = true;

function isConnectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; cause?: { code?: string; name?: string } };
  const code = e.code ?? e.cause?.code;
  const name = e.name ?? e.cause?.name;
  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    name === "ConnectTimeoutError" ||
    name === "AbortError"
  );
}

async function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: ac.signal });
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    if (RETRY_ON_CONNECT_ERR && isConnectError(err)) {
      return await attempt();
    }
    throw err;
  }
}

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component – safe to ignore.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // called from a Server Component – safe to ignore.
          }
        },
      },
      global: {
        fetch: timedFetch as typeof fetch,
      },
    }
  );
}

// React's cache() dedupes within a single request, so layout + page no longer
// double-call Supabase for the same session lookup.
export const getSessionUser = cache(async () => {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) return null;

    const { data: allowed } = await supabase
      .from("allowed_users")
      .select("*")
      .ilike("email", user.email)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email,
      allowed: allowed ?? null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      console.warn("[getSessionUser] Supabase unreachable — treating as signed out.");
      return null;
    }
    throw err;
  }
});

// Use in protected pages. If the session lookup fails or returns no user, we
// redirect to /login instead of letting the page crash on a null assertion.
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

// Gate a portal to specific roles. Redirects:
//  - no session -> /login
//  - not whitelisted -> /access-denied
//  - wrong role -> that role's own portal home
// Returns the user plus a guaranteed non-null `role`.
export async function requireRole(allowedRoles: AllowedUserRole[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const role = user.allowed?.role as AllowedUserRole | undefined;
  if (!role) redirect("/access-denied");
  if (!allowedRoles.includes(role)) redirect(PORTAL_HOME[role]);
  return { ...user, role };
}
