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

/** Who/what to attribute a logged geofence failure to. Optional everywhere —
 *  omitting it just skips logging (e.g. call sites that don't have an actor
 *  yet), it never affects the geofence check itself. */
export type GeofenceLogContext = {
  actorEmail: string;
  employeeId?: string | null;
  managerId?: string | null;
  action: "clock_in" | "clock_out";
};

/**
 * Best-effort record of a failed geofence check, so "why couldn't I clock in"
 * can be answered from data later instead of guessed at. Never throws — a
 * logging failure must not mask (or replace) the real geofence error.
 */
async function logGeofenceFailure(
  supabase: SupabaseClient,
  ctx: GeofenceLogContext | undefined,
  info: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    nearestStoreId: string | null;
    nearestStoreName: string | null;
    distance: number;
    radius: number;
    message: string;
  },
) {
  if (!ctx) return;
  try {
    await supabase.from("geofence_failures").insert({
      actor_email: ctx.actorEmail,
      employee_id: ctx.employeeId ?? null,
      manager_id: ctx.managerId ?? null,
      action: ctx.action,
      attempted_lat: info.lat,
      attempted_lng: info.lng,
      accuracy_m: info.accuracy ?? null,
      nearest_store_id: info.nearestStoreId,
      nearest_store_name: info.nearestStoreName,
      distance_m: info.distance,
      radius_m: info.radius,
      message: info.message,
    });
  } catch (err) {
    console.error("[geofence] failed to log failed attempt (non-blocking):", err);
  }
}

export async function verifyGeofenceAtStore(
  supabase: SupabaseClient,
  storeId: string,
  lat: number,
  lng: number,
  accuracy?: number | null,
  logCtx?: GeofenceLogContext,
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
    const message = `You're ${Math.round(distance)}m from ${store.name}. You must be within ${radius}m to clock in or out.`;
    await logGeofenceFailure(supabase, logCtx, {
      lat,
      lng,
      accuracy,
      nearestStoreId: storeId,
      nearestStoreName: store.name,
      distance,
      radius,
      message,
    });
    throw new Error(message);
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
  logCtx?: GeofenceLogContext,
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
    const message = `You're ${Math.round(nearest.distance)}m from ${nearest.name} — too far to clock in or out. You must be within ${nearest.radius}m of a store.`;
    await logGeofenceFailure(supabase, logCtx, {
      lat,
      lng,
      accuracy,
      nearestStoreId: nearest.id,
      nearestStoreName: nearest.name,
      distance: nearest.distance,
      radius: nearest.radius,
      message,
    });
    throw new Error(message);
  }
  return { id: inRange.id, name: inRange.name, distance: inRange.distance };
}
