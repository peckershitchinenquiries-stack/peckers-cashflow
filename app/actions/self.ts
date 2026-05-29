"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";

async function currentEmployee() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  const supabase = createServerSupabase();
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email.toLowerCase()}`)
    .limit(1)
    .maybeSingle();
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

/** Clear the must-change-password flag after a user changes their own password. */
export async function clearMustChangePassword() {
  const user = await getSessionUser();
  if (!user || !user.email) return { ok: false };
  const supabase = createServerSupabase();
  await supabase
    .from("allowed_users")
    .update({ must_change_password: false, temp_password: null })
    .ilike("email", user.email);
  return { ok: true };
}
