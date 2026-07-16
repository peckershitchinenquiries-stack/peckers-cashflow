// =============================================================
// Merge each employee's password-reset address onto their HR row.
//
// contact_email lives on allowed_users (the login account), not employees —
// managers have no employees row, and a single table is the only place the
// address can be held unique across every account (see migration 019). The
// employee-facing UI still wants it beside the rest of the profile, so pages
// stitch it on here rather than each doing their own join.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Employee } from "./types";

/**
 * Return the employees with `contact_email` populated from their linked login
 * account. Best-effort: if the lookup fails the rows come back with a null
 * address rather than blowing up the page — a missing email degrades to "admin
 * resets it for them", which is exactly the pre-existing behaviour.
 *
 * Reading allowed_users is staff-only under RLS, so call this from admin/manager
 * pages. Crew read their own row via getSessionUser instead.
 */
export async function withContactEmails(
  supabase: SupabaseClient,
  employees: Employee[],
): Promise<Employee[]> {
  if (employees.length === 0) return employees;

  const { data, error } = await supabase
    .from("allowed_users")
    .select("employee_id, contact_email")
    .not("employee_id", "is", null);

  if (error) {
    console.error("[contact-email] lookup failed:", error.message);
    return employees.map((e) => ({ ...e, contact_email: null }));
  }

  const byEmployee = new Map<string, string | null>(
    (data ?? []).map((r: { employee_id: string; contact_email: string | null }) => [
      r.employee_id,
      r.contact_email,
    ]),
  );

  return employees.map((e) => ({
    ...e,
    contact_email: byEmployee.get(e.id) ?? null,
  }));
}
