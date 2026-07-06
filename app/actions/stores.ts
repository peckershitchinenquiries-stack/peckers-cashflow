"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import type { StoreShiftTimes } from "@/lib/types";

/** Validate/normalise an incoming shift-times object to HH:MM strings. */
function cleanShiftTimes(t: StoreShiftTimes): StoreShiftTimes {
  const hhmm = (v: unknown, label: string) => {
    const s = String(v ?? "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(s)) throw new Error(`Invalid ${label} time`);
    return s;
  };
  return {
    driver_open: hhmm(t.driver_open, "driver open"),
    kitchen_open: hhmm(t.kitchen_open, "kitchen open"),
    evening_start: hhmm(t.evening_start, "evening start"),
    close: hhmm(t.close, "close"),
  };
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin") throw new Error("Admin only");
  return user;
}

export async function updateStore(input: {
  id: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number | null;
  shift_times?: StoreShiftTimes;
}) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const payload: Record<string, unknown> = {};
  if (input.name) payload.name = input.name.trim();
  if (input.latitude != null) payload.latitude = Number(input.latitude);
  if (input.longitude != null) payload.longitude = Number(input.longitude);
  if (input.geofence_radius_m != null)
    payload.geofence_radius_m = Math.max(50, Number(input.geofence_radius_m));
  if (input.shift_times) payload.shift_times = cleanShiftTimes(input.shift_times);

  const { error } = await supabase
    .from("stores")
    .update(payload)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "update",
    entity: "store",
    entity_id: input.id,
    changes: payload,
  });

  revalidatePath("/settings");
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}
