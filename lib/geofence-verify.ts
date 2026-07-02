// =============================================================
// Shared server-side geofence check. Reads the store's coordinates + radius and
// throws a user-facing error if the reported position is out of range. Used by
// both crew clock (app/actions/clock.ts) and manager clock
// (app/actions/manager-clock.ts) so they agree on the verdict.
//
// Takes the caller's Supabase client so RLS runs under the caller's session.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineMeters, isWithinGeofence } from "./utils";

export async function verifyGeofenceAtStore(
  supabase: SupabaseClient,
  storeId: string,
  lat: number,
  lng: number,
  accuracy?: number | null,
): Promise<{ distance: number }> {
  const { data: store } = await supabase
    .from("stores")
    .select("latitude, longitude, geofence_radius_m, name")
    .eq("id", storeId)
    .maybeSingle();

  if (!store?.latitude || !store?.longitude) {
    throw new Error("Store location not configured. Contact your manager.");
  }

  const distance = haversineMeters(
    Number(store.latitude),
    Number(store.longitude),
    lat,
    lng,
  );
  const radius = Number(store.geofence_radius_m ?? 250);
  if (!isWithinGeofence(distance, radius, accuracy)) {
    throw new Error(
      `You're ${Math.round(distance)}m from ${store.name}. You must be within ${radius}m to clock in or out.`,
    );
  }
  return { distance };
}
