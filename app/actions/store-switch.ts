"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { resolveActiveStoreId, type ActionResult } from "@/lib/types";
import { writeAudit } from "./audit";

/**
 * Switch the store a manager is operating as (multi-store, migration 020).
 *
 * Sets allowed_users.active_store_id, which current_user_store_id() reads via
 * coalesce() — so after this returns, every page AND every RLS policy treats
 * the manager as running the chosen store. Pass null to reset back to their
 * home store. The whole app is revalidated so the switch takes effect on the
 * next render.
 *
 * A manager may switch to ANY store (matching how crew can clock in anywhere).
 * Provisioning writes to allowed_users are privileged, so we use the
 * service-role client — but only ever on the CALLER's own row, keyed by the
 * id from their validated session (never a client-supplied id).
 */
export async function switchStore(storeId: string | null): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.allowed) return { ok: false, error: "Not authorised" };
    if (user.allowed.role !== "manager") {
      return { ok: false, error: "Only managers can switch stores." };
    }

    const admin = createAdminClient();

    // Validate the target store exists (null = reset to home store).
    let target: string | null = null;
    if (storeId) {
      const { data: store } = await admin
        .from("stores")
        .select("id")
        .eq("id", storeId)
        .maybeSingle();
      if (!store) return { ok: false, error: "That store no longer exists." };
      // Switching to the home store is the same as resetting — store null so the
      // account cleanly falls back rather than pinning to its own home id.
      target = store.id === user.allowed.store_id ? null : store.id;
    }

    const { error } = await admin
      .from("allowed_users")
      .update({ active_store_id: target })
      .eq("id", user.allowed.id);
    if (error) return { ok: false, error: error.message };

    await writeAudit({
      action: "manager_switch_store",
      entity: "allowed_user",
      entity_id: user.allowed.id,
      changes: {
        from: resolveActiveStoreId(user.allowed),
        to: target ?? user.allowed.store_id ?? null,
      },
    });

    // Everything a manager sees is store-scoped, so refresh the whole tree.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[store-switch] failed:", err);
    return {
      ok: false,
      error: err instanceof Error && err.message ? err.message : "Could not switch store.",
    };
  }
}
