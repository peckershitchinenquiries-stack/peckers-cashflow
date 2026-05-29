"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { PORTAL_LOGIN, type Portal } from "@/lib/types";

export async function signOutAction(formData?: FormData) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  const portal = (formData?.get("portal") as Portal) || "admin";
  redirect(PORTAL_LOGIN[portal] ?? "/login");
}
