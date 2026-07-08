"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { findEmployeeForUser } from "@/lib/employee-lookup";
import { writeAudit } from "./audit";

async function currentEmployee() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  const supabase = createServerSupabase();
  const employee = await findEmployeeForUser(supabase, user.id, user.email);
  if (!employee) throw new Error("No crew profile linked to your account");
  return { user, employeeId: employee.id, supabase };
}

/** An employee updates their own contact + bank details (RLS-restricted to own row). */
export async function updateOwnProfile(input: {
  phone?: string | null;
  bank_account_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  sort_code?: string | null;
}) {
  const { employeeId, supabase } = await currentEmployee();
  const { error } = await supabase
    .from("employees")
    .update({
      phone: input.phone?.trim() || null,
      bank_account_name: input.bank_account_name?.trim() || null,
      bank_name: input.bank_name?.trim() || null,
      account_number: input.account_number?.trim() || null,
      sort_code: input.sort_code?.trim() || null,
    })
    .eq("id", employeeId);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "update_own_profile",
    entity: "employee",
    entity_id: employeeId,
  });

  revalidatePath("/employee/profile");
  return { ok: true };
}

/**
 * Clear the must-change-password flag after a user changes their own password.
 *
 * allowed_users writes are admin-only under RLS, so a manager/employee clearing
 * their OWN flag with the anon client would silently affect 0 rows — leaving
 * must_change_password=true and trapping them on /change-password. We use the
 * service-role client, scoped strictly to the authenticated user's own email,
 * to bypass RLS for this one safe self-update. Falls back to the RLS client
 * (works for admins) if provisioning isn't configured.
 */
export async function clearMustChangePassword() {
  const user = await getSessionUser();
  if (!user || !user.email) return { ok: false };
  try {
    const client = isProvisioningConfigured()
      ? createAdminClient()
      : createServerSupabase();
    const { error } = await client
      .from("allowed_users")
      .update({ must_change_password: false, temp_password: null })
      .ilike("email", user.email);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[self] clearMustChangePassword failed:", err);
    return { ok: false };
  }
  return { ok: true };
}
