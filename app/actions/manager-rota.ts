"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { shiftHours, todayISO } from "@/lib/utils";

// Managers are provisioned/managed by admin only (see /managers), and the
// edit UI for this table only exists on the admin Rota page — so, unlike
// employee rota_shifts (which managers can also edit), writes here are
// admin-only. Mirrors the manager_shifts_modify RLS policy.
async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin") {
    throw new Error("Only admin can edit the manager rota.");
  }
  return user;
}

export type ManagerShiftInput = {
  manager_id: string;
  store_id: string;
  shift_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_day_off?: boolean;
  notes?: string | null;
};

/** Upsert a manager's shift cell. Computes scheduled hours. */
export async function upsertManagerShift(input: ManagerShiftInput) {
  const user = await requireAdmin();
  const supabase = createServerSupabase();

  if (!input.manager_id) throw new Error("Missing manager");
  if (!input.store_id) throw new Error("Missing store");
  if (!input.shift_date) throw new Error("Missing date");

  // Past days are read-only — only today and future shifts can be edited.
  if (input.shift_date < todayISO()) {
    throw new Error(
      "Past days are locked. You can view previous shifts but only edit today or upcoming days.",
    );
  }

  const isDayOff = !!input.is_day_off;
  const start = isDayOff ? null : input.start_time?.slice(0, 5) || null;
  const end = isDayOff ? null : input.end_time?.slice(0, 5) || null;

  if (!isDayOff && (!start || !end)) {
    throw new Error(
      "Enter both a start and end time, or mark the day as a Day Off.",
    );
  }
  const hours = isDayOff ? 0 : shiftHours(start, end);

  const { data: existing } = await supabase
    .from("manager_shifts")
    .select("*")
    .eq("manager_id", input.manager_id)
    .eq("shift_date", input.shift_date)
    .maybeSingle();

  const payload = {
    manager_id: input.manager_id,
    store_id: input.store_id,
    shift_date: input.shift_date,
    start_time: start,
    end_time: end,
    is_day_off: isDayOff,
    scheduled_hours: hours,
    notes: input.notes?.trim() || null,
    updated_by: user.id,
  };

  if (existing) {
    const { error } = await supabase
      .from("manager_shifts")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      action: "update",
      entity: "manager_shift",
      entity_id: existing.id,
      changes: { before: existing, after: payload },
    });
  } else {
    const { error } = await supabase
      .from("manager_shifts")
      .insert({ ...payload, created_by: user.id });
    if (error) throw new Error(error.message);
    await writeAudit({
      action: "create",
      entity: "manager_shift",
      entity_id: `${input.manager_id}:${input.shift_date}`,
      changes: payload,
    });
  }

  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}

export async function deleteManagerShift(id: string) {
  await requireAdmin();
  const supabase = createServerSupabase();

  // Block clearing shifts on past days — they are read-only.
  const { data: existing } = await supabase
    .from("manager_shifts")
    .select("shift_date")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.shift_date < todayISO()) {
    throw new Error(
      "Past days are locked. You can view previous shifts but only edit today or upcoming days.",
    );
  }

  const { error } = await supabase.from("manager_shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({ action: "delete", entity: "manager_shift", entity_id: id });
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}
