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

export type DetectedStore = {
  id: string;
  name: string;
  distance: number;
};

/**
 * Find which store the caller is physically at, so an employee can clock in at
 * ANY store (not just their home one) — the store they're standing in is the
 * store the day's work is attributed to. Returns the nearest store whose
 * geofence contains the reported position. Throws a helpful, distance-aware
 * error when the position is outside every store's radius.
 *
 * Stores with no configured coordinates are skipped (admin must set them first).
 */
export async function detectStoreForLocation(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  accuracy?: number | null,
): Promise<DetectedStore> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, latitude, longitude, geofence_radius_m");

  const located = (stores ?? []).filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  if (located.length === 0) {
    throw new Error(
      "No store locations are configured yet. Ask your admin to set the store coordinates.",
    );
  }

  type Ranked = { id: string; name: string; distance: number; radius: number };
  const ranked: Ranked[] = located
    .map((s) => ({
      id: s.id as string,
      name: s.name as string,
      distance: haversineMeters(Number(s.latitude), Number(s.longitude), lat, lng),
      radius: Number(s.geofence_radius_m ?? 250),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Nearest store whose geofence (allowing for GPS accuracy) contains the point.
  const inRange = ranked.find((s) => isWithinGeofence(s.distance, s.radius, accuracy));
  if (!inRange) {
    const nearest = ranked[0];
    throw new Error(
      `You're ${Math.round(nearest.distance)}m from ${nearest.name} — too far to clock in or out. You must be within ${nearest.radius}m of a store.`,
    );
  }
  return { id: inRange.id, name: inRange.name, distance: inRange.distance };
}
