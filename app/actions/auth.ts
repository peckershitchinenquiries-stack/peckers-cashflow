"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { PORTAL_LOGIN, type Portal } from "@/lib/types";
import { deleteNativePushToken } from "@/app/actions/push";
import { deleteManagerNativePushToken } from "@/app/actions/manager-push";

export async function signOutAction(formData?: FormData) {
  const portal = (formData?.get("portal") as Portal) || "admin";

  // Sent by NativeSignOutToken from inside the app. Removed while the session
  // still exists, because both deletes are scoped to the signed-in person.
  // A failure here must never block the sign-out itself.
  const nativeToken = formData?.get("native_token");
  if (typeof nativeToken === "string" && nativeToken) {
    try {
      if (portal === "employee") await deleteNativePushToken(nativeToken);
      else if (portal === "manager") await deleteManagerNativePushToken(nativeToken);
    } catch (err) {
      console.error("[auth] native token cleanup on sign-out failed:", err);
    }
  }

  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect(PORTAL_LOGIN[portal] ?? "/login");
}
