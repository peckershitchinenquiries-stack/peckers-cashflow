"use server";

import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";

/**
 * Write an audit-log row. Best-effort: failures are logged but do not throw,
 * so they cannot block the user action that triggered them.
 */
export async function writeAudit(input: {
  action: string;
  entity: string;
  entity_id?: string | null;
  changes?: Record<string, unknown> | null;
}) {
  try {
    const user = await getSessionUser();
    const supabase = createServerSupabase();
    await supabase.from("audit_log").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      changes: input.changes ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}
