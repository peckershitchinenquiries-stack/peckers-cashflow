"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { verifyGeofenceAtStore } from "@/lib/geofence-verify";
import { todayISO } from "@/lib/utils";
import { writeAudit } from "./audit";

// Managers clock in/out for MONITORING only — it never touches their fixed
// salary. Managers are login accounts (allowed_users), not employees, so their
// attendance lives in manager_clock_events keyed on the login account id.

async function requireManager() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "manager") {
    throw new Error("Only managers can clock in or out here.");
  }
  return user;
}

type ClockInput = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export async function managerClockIn(input: ClockInput) {
  const user = await requireManager();
  const supabase = createServerSupabase();
  const managerId = user.allowed!.id;
  const storeId = user.allowed!.store_id;
  if (!storeId) throw new Error("You're not assigned to a store yet.");

  await verifyGeofenceAtStore(
    supabase,
    storeId,
    input.latitude,
    input.longitude,
    input.accuracy,
  );

  const today = todayISO();
  const { data: existing } = await supabase
    .from("manager_clock_events")
    .select("*")
    .eq("manager_id", managerId)
    .eq("event_date", today)
    .maybeSingle();

  if (existing?.clock_in_at) throw new Error("You've already clocked in today.");

  const now = new Date().toISOString();
  const payload = {
    manager_id: managerId,
    store_id: storeId,
    event_date: today,
    clock_in_at: now,
    clock_in_lat: input.latitude,
    clock_in_lng: input.longitude,
  };

  if (existing) {
    const { error } = await supabase
      .from("manager_clock_events")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("manager_clock_events").insert(payload);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: "manager_clock_in",
    entity: "manager_clock_event",
    entity_id: managerId,
    changes: { date: today, location: [input.latitude, input.longitude] },
  });

  revalidatePath("/manager/live");
  revalidatePath("/live");
  return { ok: true };
}

export async function managerClockOut(input: ClockInput) {
  const user = await requireManager();
  const supabase = createServerSupabase();
  const managerId = user.allowed!.id;
  const storeId = user.allowed!.store_id;
  if (!storeId) throw new Error("You're not assigned to a store yet.");

  await verifyGeofenceAtStore(
    supabase,
    storeId,
    input.latitude,
    input.longitude,
    input.accuracy,
  );

  const today = todayISO();
  const { data: existing } = await supabase
    .from("manager_clock_events")
    .select("*")
    .eq("manager_id", managerId)
    .eq("event_date", today)
    .maybeSingle();

  if (!existing?.clock_in_at) throw new Error("You haven't clocked in yet today.");
  if (existing.clock_out_at) throw new Error("You've already clocked out today.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("manager_clock_events")
    .update({
      clock_out_at: now,
      clock_out_lat: input.latitude,
      clock_out_lng: input.longitude,
    })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "manager_clock_out",
    entity: "manager_clock_event",
    entity_id: managerId,
    changes: { date: today, location: [input.latitude, input.longitude] },
  });

  revalidatePath("/manager/live");
  revalidatePath("/live");
  return { ok: true };
}
