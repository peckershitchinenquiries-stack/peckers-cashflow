"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { shiftHours, todayISO } from "@/lib/utils";

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

export type RotaShiftInput = {
  id?: string;
  employee_id: string;
  store_id: string;
  shift_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_day_off?: boolean;
  manager_notes?: string | null;
  same_day_edit_reason?: string | null;
};

/** Upsert a shift cell. Computes scheduled hours. */
export async function upsertShift(input: RotaShiftInput) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  if (!input.employee_id) throw new Error("Missing employee");
  if (!input.store_id) throw new Error("Missing store");
  if (!input.shift_date) throw new Error("Missing date");

  const isDayOff = !!input.is_day_off;
  const start = isDayOff ? null : input.start_time?.slice(0, 5) || null;
  const end = isDayOff ? null : input.end_time?.slice(0, 5) || null;
  const hours = isDayOff ? 0 : shiftHours(start, end);

  // Same-day edits require a reason.
  const isSameDay = input.shift_date === todayISO();

  // Find existing first to detect mid-day changes
  const { data: existing } = await supabase
    .from("rota_shifts")
    .select("*")
    .eq("employee_id", input.employee_id)
    .eq("shift_date", input.shift_date)
    .maybeSingle();

  const changed =
    !existing ||
    existing.start_time !== (start ? start + ":00" : null) ||
    existing.end_time !== (end ? end + ":00" : null) ||
    existing.is_day_off !== isDayOff;

  if (isSameDay && existing && changed && !input.same_day_edit_reason?.trim()) {
    throw new Error(
      "Same-day shift edits require a reason (e.g. 'Left early – family emergency').",
    );
  }

  const payload = {
    employee_id: input.employee_id,
    store_id: input.store_id,
    shift_date: input.shift_date,
    start_time: start,
    end_time: end,
    is_day_off: isDayOff,
    scheduled_hours: hours,
    manager_notes: input.manager_notes?.trim() || null,
    same_day_edit_reason:
      isSameDay && changed ? input.same_day_edit_reason?.trim() || null : existing?.same_day_edit_reason ?? null,
    updated_by: user.id,
  };

  if (existing) {
    const { error } = await supabase
      .from("rota_shifts")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      action: "update",
      entity: "rota_shift",
      entity_id: existing.id,
      changes: { before: existing, after: payload },
    });
  } else {
    const { error } = await supabase
      .from("rota_shifts")
      .insert({ ...payload, created_by: user.id });
    if (error) throw new Error(error.message);
    await writeAudit({
      action: "create",
      entity: "rota_shift",
      entity_id: `${input.employee_id}:${input.shift_date}`,
      changes: payload,
    });
  }

  revalidatePath("/rota");
  revalidatePath("/live");
  revalidatePath("/crew");
  return { ok: true };
}

export async function deleteShift(id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("rota_shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({ action: "delete", entity: "rota_shift", entity_id: id });
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}

export async function upsertWeeklyDelivery(input: {
  driver_id: string;
  store_id: string;
  week_start_date: string;
  manager_avg_4wk?: number | null;
  vita_mojo_count?: number | null;
  notes?: string | null;
  reason?: string | null;
}) {
  await requireAllowed();
  const supabase = createServerSupabase();

  const { data: existing } = await supabase
    .from("weekly_deliveries")
    .select("id")
    .eq("driver_id", input.driver_id)
    .eq("week_start_date", input.week_start_date)
    .maybeSingle();

  const payload = {
    driver_id: input.driver_id,
    store_id: input.store_id,
    week_start_date: input.week_start_date,
    manager_avg_4wk:
      input.manager_avg_4wk != null ? Number(input.manager_avg_4wk) : null,
    vita_mojo_count: input.vita_mojo_count != null ? Number(input.vita_mojo_count) : null,
    notes: input.notes?.trim() || null,
    reason: input.reason?.trim() || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("weekly_deliveries")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("weekly_deliveries").insert(payload);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "upsert",
    entity: "weekly_delivery",
    entity_id: existing?.id ?? `${input.driver_id}:${input.week_start_date}`,
    changes: payload,
  });

  revalidatePath("/rota");
  return { ok: true };
}
