"use server";

// =============================================================
// Clock-in / clock-out push reminders — MANAGER subscription management.
//
// Mirrors app/actions/push.ts (employee side). Managers are login accounts
// (allowed_users), not employees, so their subscriptions live in their own
// table — same split as manager-clock.ts vs clock.ts.
// =============================================================

import { getSessionUser } from "@/lib/supabase-server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { isPushConfigured, sendPushToManager } from "@/lib/push";
import type { ActionResult } from "@/lib/types";
import type { BrowserSubscription } from "./push";

async function requireManager() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "manager") {
    throw new Error("Only managers can manage reminders here.");
  }
  return user.allowed;
}

export async function saveManagerPushSubscription(
  sub: BrowserSubscription,
  userAgent?: string | null,
): Promise<ActionResult> {
  try {
    if (!isPushConfigured()) {
      return { ok: false, error: "Push notifications aren't set up on the server yet." };
    }
    if (!isProvisioningConfigured()) {
      return { ok: false, error: "Server is not configured to save subscriptions." };
    }
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return { ok: false, error: "Invalid push subscription." };
    }

    const manager = await requireManager();
    const admin = createAdminClient();

    const { error } = await admin.from("manager_push_subscriptions").upsert(
      {
        manager_id: manager.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (err) {
    console.error("[push] saveManagerPushSubscription failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not enable reminders.",
    };
  }
}

export async function deleteManagerPushSubscription(endpoint: string): Promise<ActionResult> {
  try {
    if (!endpoint) return { ok: true };
    if (!isProvisioningConfigured()) return { ok: true };

    const manager = await requireManager();
    const admin = createAdminClient();
    const { error } = await admin
      .from("manager_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("manager_id", manager.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    console.error("[push] deleteManagerPushSubscription failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not turn reminders off.",
    };
  }
}

export async function sendManagerTestPush(): Promise<ActionResult> {
  try {
    if (!isPushConfigured()) {
      return { ok: false, error: "Push notifications aren't set up on the server yet." };
    }
    if (!isProvisioningConfigured()) {
      return { ok: false, error: "Server is not configured for push." };
    }
    const manager = await requireManager();
    const admin = createAdminClient();
    const delivered = await sendPushToManager(admin, manager.id, {
      title: "Reminders are on ✅",
      body: "You'll get a nudge here when it's time to clock in and out.",
      url: "/manager/live",
      tag: "peckers-test",
    });
    if (delivered === 0) {
      return {
        ok: false,
        error: "No device received it. Re-enable reminders on this device and try again.",
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("[push] sendManagerTestPush failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not send a test notification.",
    };
  }
}
