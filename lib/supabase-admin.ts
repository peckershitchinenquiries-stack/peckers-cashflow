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

/**
 * Look up an auth user by their login email (allowed_users.email — the synthetic
 * `<username>@staff.peckers-app.co.uk` address for managers/crew, a real one for
 * admins).
 *
 * The Auth Admin API has no get-by-email, so this pages through listUsers and
 * matches case-insensitively. Fine at this scale (tens of staff); if the group
 * ever outgrows the page cap, store the auth id on allowed_users and look it up
 * directly instead of raising the limit.
 */
export async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const target = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return (
    data?.users?.find((u) => (u.email ?? "").toLowerCase() === target) ?? null
  );
}
