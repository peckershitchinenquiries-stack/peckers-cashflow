"use client";

// =============================================================
// Precise browser geolocation acquisition.
//
// A single navigator.geolocation.getCurrentPosition() usually resolves with the
// FIRST fix the OS has — frequently a coarse Wi-Fi/IP/network estimate (hundreds
// of metres to several kilometres, and often plain wrong) — before the GPS chip
// has actually locked. Trusting that first fix is exactly how a store ends up
// pinned kilometres from where it really is.
//
// getBestPosition() instead watchPosition()es and keeps improving, returning the
// most accurate reading it can get within a time budget. It resolves early once
// a fix is good enough. This is what makes clock-in and store-capture trust the
// GPS, not the network guess.
// =============================================================

export type Fix = { lat: number; lng: number; accuracy: number };

/**
 * Above this (± metres) a fix is an APPROXIMATE location, not a GPS one.
 *
 * Android 12+ lets a user grant "Approximate" instead of "Precise", and the
 * Peckers Android shell's WebView honours that — the position still arrives,
 * at 1–3km accuracy. Against a 250m geofence with 100m of accuracy slack
 * (GEOFENCE_ACCURACY_TOLERANCE_M) that reads as plain "Out of range", so the
 * staff member is told to move closer to a store they are already standing in
 * front of. It needs naming as its own cause.
 *
 * 500m sits in the empty gap between the two regimes: real GPS/fused fixes land
 * at 5–100m even indoors, Android's approximate grid at 1000m+. Anything past
 * it is useless against our radii whatever produced it, so the distinct message
 * is right either way.
 */
export const COARSE_FIX_ACCURACY_M = 500;

export function isCoarseFix(accuracyM: number): boolean {
  return accuracyM > COARSE_FIX_ACCURACY_M;
}

/** Permission state, when the browser will tell us. "denied" means BLOCKED —
 *  no prompt will be shown again, so Retry alone cannot fix it. */
export type GeoPermissionState = "granted" | "prompt" | "denied" | "unknown";

export async function readGeolocationPermission(): Promise<GeoPermissionState> {
  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state as GeoPermissionState;
  } catch {
    // Safari and the Android WebView may not answer for geolocation at all.
    return "unknown";
  }
}

export type BestPositionOptions = {
  /** Resolve early as soon as a fix at least this accurate (± metres) arrives. */
  desiredAccuracyM?: number;
  /** Max time to keep trying to improve the fix before returning the best so far (ms). */
  maxWaitMs?: number;
  /** Called with each new best fix so the UI can show live progress. */
  onProgress?: (fix: Fix) => void;
};

/** The rejection carries the original GeolocationPositionError when available,
 *  so callers can distinguish permission-denied (code 1) from other failures. */
export function getBestPosition(opts: BestPositionOptions = {}): Promise<Fix> {
  const desiredAccuracyM = opts.desiredAccuracyM ?? 30;
  const maxWaitMs = opts.maxWaitMs ?? 12_000;

  return new Promise<Fix>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this device."));
      return;
    }

    // Chromium refuses geolocation outside a secure context, and an Android
    // WebView targeting API 23+ denies it WITHOUT ever showing the permission
    // prompt — so the failure arrives as a bare permission denial that looks
    // exactly like the user tapping "Don't allow". Naming it here is the only
    // way the message can be true: no permission change fixes an http origin.
    // localhost counts as secure, so desktop dev is unaffected.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      reject(
        new Error(
          "This page is not on a secure (HTTPS) connection, so location is blocked before you are even asked. Open the app on its normal https address.",
        ),
      );
      return;
    }

    let best: Fix | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (timer != null) clearTimeout(timer);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (best) resolve(best);
      else
        reject(
          new Error(
            "Could not get a location fix. Move to open sky and try again.",
          ),
        );
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        // Keep the tightest (lowest ±metres) reading seen so far.
        if (!best || fix.accuracy < best.accuracy) {
          best = fix;
          opts.onProgress?.(fix);
        }
        if (fix.accuracy <= desiredAccuracyM) finish();
      },
      (err) => {
        // Only fail hard if we have nothing usable yet. A transient
        // POSITION_UNAVAILABLE after we already have a good fix is ignored.
        if (!best) {
          settled = true;
          cleanup();
          reject(err);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
    );

    timer = setTimeout(finish, maxWaitMs);
  });
}

/** True when a GeolocationPositionError (or anything) is a permission denial. */
export function isPermissionDenied(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    (err as GeolocationPositionError).code === 1
  );
}
