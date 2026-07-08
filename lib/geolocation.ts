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
