"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { shiftHours, todayISO } from "@/lib/utils";
import { resolveActiveStoreId } from "@/lib/types";

// Admin books any store; a manager books only the store they're running, so
// they can schedule a peer without gaining anything else admin can do.
// Mirrors the manager_shifts_modify RLS policy (migration 076).
async function requireRotaEditor(): Promise<{
  userId: string;
  scopeStoreId: string | null;
}> {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  const role = user.allowed.role;
  if (role === "admin") return { userId: user.id, scopeStoreId: null };
  if (role !== "manager") throw new Error("Not authorised");
  const activeStore = resolveActiveStoreId(user.allowed);
  if (!activeStore) throw new Error("No store assigned to your account.");
  return { userId: user.id, scopeStoreId: activeStore };
}

// One booking per manager per date across the estate, so another store's
// booking would be overwritten by an upsert from here — refuse instead.
function assertBookingInScope(
  scopeStoreId: string | null,
  bookingStoreId: string | null | undefined,
) {
  if (!scopeStoreId || !bookingStoreId || bookingStoreId === scopeStoreId) return;
  throw new Error(
    "This manager is already booked at another store that day. Ask that store's manager or an admin to change it.",
  );
}

function revalidateManagerRotaPaths() {
  revalidatePath("/rota");
  revalidatePath("/manager/rota");
  revalidatePath("/live");
  revalidatePath("/manager/live");
}

export type ManagerShiftInput = {
  manager_id: string;
  store_id: string;
  shift_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_day_off?: boolean;
  /** Only honoured with is_day_off — leave is a labelled Day Off. */
  is_on_leave?: boolean;
  notes?: string | null;
};

/** Upsert a manager's shift cell. Computes scheduled hours. */
export async function upsertManagerShift(input: ManagerShiftInput) {
  const { userId, scopeStoreId } = await requireRotaEditor();
  const supabase = createServerSupabase();

  if (!input.manager_id) throw new Error("Missing manager");
  if (!input.store_id) throw new Error("Missing store");
  if (!input.shift_date) throw new Error("Missing date");
  if (scopeStoreId && input.store_id !== scopeStoreId) {
    throw new Error("You can only book shifts at the store you're managing.");
  }

  const { data: target } = await supabase
    .from("allowed_users")
    .select("id, role")
    .eq("id", input.manager_id)
    .maybeSingle();
  if (!target || target.role !== "manager") {
    throw new Error("That account isn't a manager.");
  }

  // Past days are read-only — only today and future shifts can be edited.
  if (input.shift_date < todayISO()) {
    throw new Error(
      "Past days are locked. You can view previous shifts but only edit today or upcoming days.",
    );
  }

  const isDayOff = !!input.is_day_off;
  const isOnLeave = isDayOff && !!input.is_on_leave;
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
  assertBookingInScope(scopeStoreId, existing?.store_id);

  const payload = {
    manager_id: input.manager_id,
    store_id: input.store_id,
    shift_date: input.shift_date,
    start_time: start,
    end_time: end,
    is_day_off: isDayOff,
    is_on_leave: isOnLeave,
    scheduled_hours: hours,
    notes: input.notes?.trim() || null,
    updated_by: userId,
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
      .insert({ ...payload, created_by: userId });
    if (error) throw new Error(error.message);
    await writeAudit({
      action: "create",
      entity: "manager_shift",
      entity_id: `${input.manager_id}:${input.shift_date}`,
      changes: payload,
    });
  }

  revalidateManagerRotaPaths();
  return { ok: true };
}

export async function deleteManagerShift(id: string) {
  const { scopeStoreId } = await requireRotaEditor();
  const supabase = createServerSupabase();

  // Block clearing shifts on past days — they are read-only.
  const { data: existing } = await supabase
    .from("manager_shifts")
    .select("shift_date, store_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("Shift not found.");
  assertBookingInScope(scopeStoreId, existing.store_id);
  if (existing.shift_date < todayISO()) {
    throw new Error(
      "Past days are locked. You can view previous shifts but only edit today or upcoming days.",
    );
  }

  const { error } = await supabase.from("manager_shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({ action: "delete", entity: "manager_shift", entity_id: id });
  revalidateManagerRotaPaths();
  return { ok: true };
}
