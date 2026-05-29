"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin" && user.allowed.role !== "super_admin") {
    throw new Error("Admin only");
  }
  return user;
}

type AllowedRole = "admin" | "manager" | "super_admin";

function normaliseRole(r: AllowedRole | undefined): AllowedRole {
  if (r === "admin" || r === "manager" || r === "super_admin") return r;
  return "manager";
}

export async function addAllowedUser(input: {
  email: string;
  name?: string | null;
  role?: AllowedRole;
  store_id?: string | null;
}) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");

  const { error } = await supabase.from("allowed_users").insert({
    email,
    name: input.name?.trim() || null,
    role: normaliseRole(input.role),
    store_id: input.store_id || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeAllowedUser(id: string) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("allowed_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateAllowedUserRole(input: { id: string; role: AllowedRole }) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("allowed_users")
    .update({ role: normaliseRole(input.role) })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateAllowedUserStore(input: { id: string; store_id: string | null }) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("allowed_users")
    .update({ store_id: input.store_id || null })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}
