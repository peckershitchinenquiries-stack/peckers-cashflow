"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings,
  type SettingsKey,
} from "@/lib/settings";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin") throw new Error("Admin only");
  return user;
}

/**
 * Read merged settings (defaults <- stored overrides). RLS limits the row read
 * to staff; for anyone else (or on error) this returns the safe defaults.
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("app_settings").select("key, value");
    return mergeSettings(data ?? []);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Admin-only: upsert one or more settings keys. */
export async function updateSettings(
  partial: Partial<AppSettings>,
): Promise<{ ok: true }> {
  const user = await requireAdmin();
  const supabase = createServerSupabase();

  const entries = Object.entries(partial) as Array<[SettingsKey, unknown]>;
  for (const [key, value] of entries) {
    if (value == null) continue;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value, updated_by: user.id }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "update_settings",
    entity: "app_settings",
    entity_id: entries.map(([k]) => k).join(","),
    changes: partial as Record<string, unknown>,
  });

  revalidatePath("/settings");
  revalidatePath("/alerts");
  return { ok: true };
}
