"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin") throw new Error("Admin only");
  return user;
}

export async function addAllowedUser(input: {
  email: string;
  name?: string | null;
  role?: "admin" | "manager";
}) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");

  const { error } = await supabase.from("allowed_users").insert({
    email,
    name: input.name?.trim() || null,
    role: input.role === "admin" ? "admin" : "manager",
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

export async function updateAllowedUserRole(input: { id: string; role: "admin" | "manager" }) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("allowed_users")
    .update({ role: input.role })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}
