"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin" && user.allowed.role !== "super_admin") {
    throw new Error("Admin only");
  }
  return user;
}

export async function updateStore(input: {
  id: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number | null;
}) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const payload: Record<string, unknown> = {};
  if (input.name) payload.name = input.name.trim();
  if (input.latitude != null) payload.latitude = Number(input.latitude);
  if (input.longitude != null) payload.longitude = Number(input.longitude);
  if (input.geofence_radius_m != null)
    payload.geofence_radius_m = Math.max(50, Number(input.geofence_radius_m));

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
