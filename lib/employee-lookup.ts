// =============================================================
// Resolve the employee row for a logged-in user.
//
// A user can match more than one employees row (e.g. an admin re-provisioned
// someone, leaving an old inactive duplicate whose email or auth id still
// matches). The old `.or(...).limit(1)` pattern picked an ARBITRARY row in that
// case — if it picked the inactive duplicate, clock-in refused with "account
// not active" and the rota looked empty. This helper is deterministic:
//   1. prefer the row whose auth_user_id matches the session user,
//   2. then prefer active rows over inactive/left ones.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Employee } from "./types";

export async function findEmployeeForUser(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<Employee | null> {
  const { data } = await supabase
    .from("employees")
    .select("*")
    .or(`auth_user_id.eq.${userId},email.eq.${userEmail.toLowerCase()}`);

  const rows = (data ?? []) as Employee[];
  if (rows.length <= 1) return rows[0] ?? null;

  const score = (e: Employee) =>
    (e.auth_user_id === userId ? 2 : 0) +
    (e.employment_status === "active" ? 1 : 0);
  return rows.sort((a, b) => score(b) - score(a))[0];
}
