import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS and can use the Auth Admin API
 * (auth.admin.createUser / updateUserById / deleteUser).
 *
 * SECURITY: only ever import this from server-side code (server actions, which
 * are the only callers here). The service key must live in
 * SUPABASE_SERVICE_ROLE_KEY (NOT a NEXT_PUBLIC_ var) so it never reaches the
 * browser bundle.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Account provisioning is not configured. Set SUPABASE_SERVICE_ROLE_KEY in the server environment.",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isProvisioningConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
