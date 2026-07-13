"use server";

// =============================================================
// Clock-in / clock-out push reminders — subscription management.
//
// The employee opts in from their browser (ClockReminderOptIn). These actions
// persist / remove that device's Web Push subscription, and let them fire a
// test notification to confirm it works.
//
// Auth: the caller is resolved to their crew profile (getSessionUser +
// findEmployeeForUser); writes then use the service-role admin client, the same
// pattern account provisioning and auto-shift creation use.
// =============================================================

import { getSessionUser, createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { findEmployeeForUser } from "@/lib/employee-lookup";
import { isPushConfigured, sendPushToEmployee } from "@/lib/push";
import type { ActionResult } from "@/lib/types";

/** Shape the browser's PushSubscription serialises to (subscription.toJSON()). */
export type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

async function requireEmployee() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  const employee = await findEmployeeForUser(createServerSupabase(), user.id, user.email);
  if (!employee) throw new Error("Your account is not linked to a crew profile.");
  return employee;
}

/**
 * Store (or refresh) the Web Push subscription for the device the employee just
 * enabled reminders on. Upsert on `endpoint` so re-enabling the same browser
 * updates its keys instead of creating duplicate rows.
 */
export async function savePushSubscription(
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

    const employee = await requireEmployee();
    const admin = createAdminClient();

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        employee_id: employee.id,
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
    console.error("[push] savePushSubscription failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not enable reminders.",
    };
  }
}

/** Remove a device's subscription (employee turned reminders off / signed out). */
export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  try {
    if (!endpoint) return { ok: true };
    if (!isProvisioningConfigured()) return { ok: true };

    const employee = await requireEmployee();
    const admin = createAdminClient();
    // Scope the delete to this employee so one crew member can't remove another's.
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("employee_id", employee.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    console.error("[push] deletePushSubscription failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not turn reminders off.",
    };
  }
}

/** Fire a test notification to the caller's own devices, to confirm setup. */
export async function sendTestPush(): Promise<ActionResult> {
  try {
    if (!isPushConfigured()) {
      return { ok: false, error: "Push notifications aren't set up on the server yet." };
    }
    if (!isProvisioningConfigured()) {
      return { ok: false, error: "Server is not configured for push." };
    }
    const employee = await requireEmployee();
    const admin = createAdminClient();
    const delivered = await sendPushToEmployee(admin, employee.id, {
      title: "Reminders are on ✅",
      body: "You'll get a nudge here when it's time to clock in and out.",
      url: "/employee/attendance",
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
    console.error("[push] sendTestPush failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not send a test notification.",
    };
  }
}
