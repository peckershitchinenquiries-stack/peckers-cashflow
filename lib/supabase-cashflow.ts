import { createClient } from "@supabase/supabase-js";

/**
 * Cashflow Supabase instance client (SERVER-ONLY).
 *
 * Used for reading rota / labor / cashflow data for the VM Analytics
 * "Labor Cost Performance" dashboard.
 *
 * Uses the SERVICE-ROLE key, which bypasses RLS. This is required because the
 * underlying operational tables (stores, daily_cash_entries, employee_weekly_
 * summary, …) are RLS-protected and the public anon key returns zero rows for
 * them by design. The Labor Cost page is a server component sitting behind the
 * app's auth middleware, so the service key is only ever used on the server.
 *
 * SECURITY: only import this from server-side code (server components / server
 * actions). The key lives in SUPABASE_SERVICE_ROLE_KEY (NOT a NEXT_PUBLIC_ var)
 * so it never reaches the browser bundle. Do NOT import this from any file that
 * carries "use client".
 */
export function getCashflowSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Cashflow Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
