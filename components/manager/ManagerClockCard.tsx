"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ClockIcon } from "@/components/ui/icons";
import { managerClockIn, managerClockOut } from "@/app/actions/manager-clock";
import { getBestPosition, isPermissionDenied } from "@/lib/geolocation";
import {
  clockedHours,
  formatTimeOnly,
  haversineMeters,
  isWithinGeofence,
} from "@/lib/utils";
import type { ManagerClockEvent, Store } from "@/lib/types";

type Props = {
  managerName: string;
  store: Store | null;
  todayClock: ManagerClockEvent | null;
};

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number; accuracy: number; distance: number | null }
  | { status: "denied" | "error"; message: string };

export function ManagerClockCard({ managerName, store, todayClock }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [geo, setGeo] = React.useState<GeoState>({ status: "idle" });
  const [busy, setBusy] = React.useState(false);

  const storeConfigured = store?.latitude != null && store?.longitude != null;

  const requestLocation = React.useCallback(() => {
    setGeo({ status: "loading" });
    // Converge on a precise GPS fix rather than trusting the first coarse
    // (Wi-Fi/network) reading, so the distance/in-range verdict is trustworthy.
    getBestPosition({ desiredAccuracyM: 30, maxWaitMs: 12_000 })
      .then((fix) => {
        const distance =
          store?.latitude != null && store?.longitude != null
            ? haversineMeters(
                Number(store.latitude),
                Number(store.longitude),
                fix.lat,
                fix.lng,
              )
            : null;
        setGeo({
          status: "ok",
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
          distance,
        });
      })
      .catch((err: unknown) => {
        if (isPermissionDenied(err)) {
          setGeo({
            status: "denied",
            message: "Location permission denied. Enable it in your browser settings, then tap Retry.",
          });
        } else {
          setGeo({
            status: "error",
            message: err instanceof Error ? err.message : "Could not get your location. Tap Retry.",
          });
        }
      });
  }, [store?.latitude, store?.longitude]);

  React.useEffect(() => {
    if (storeConfigured) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inRange =
    geo.status === "ok" &&
    store?.geofence_radius_m != null &&
    geo.distance != null &&
    isWithinGeofence(geo.distance, store.geofence_radius_m, geo.accuracy);

  const clockedIn = !!todayClock?.clock_in_at && !todayClock?.clock_out_at;
  const clockedOut = !!todayClock?.clock_out_at;
  const phase: "in" | "out" | "done" = clockedOut ? "done" : clockedIn ? "out" : "in";
  const workedToday = todayClock?.clock_out_at
    ? clockedHours(todayClock.clock_in_at, todayClock.clock_out_at)
    : 0;

  async function act() {
    if (geo.status !== "ok") {
      toast.error("Capture your location first.");
      return;
    }
    setBusy(true);
    try {
      const payload = { latitude: geo.lat, longitude: geo.lng, accuracy: geo.accuracy };
      const res =
        phase === "out" ? await managerClockOut(payload) : await managerClockIn(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(phase === "out" ? "Clocked out. Thanks!" : "Clocked in. Have a good shift!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-gold/30">
      <CardHeader>
        <div>
          <CardTitle>Your attendance</CardTitle>
          <CardDescription>
            {managerName} · clock in when you arrive at {store?.name ?? "your store"}. This is for
            monitoring only — it doesn&apos;t change your salary.
          </CardDescription>
        </div>
      </CardHeader>

      {!store ? (
        <p className="text-sm text-danger">
          You&apos;re not assigned to a store yet. Ask your admin to set your store.
        </p>
      ) : !storeConfigured ? (
        <p className="text-sm text-danger">
          Your store&apos;s location hasn&apos;t been set up yet. Ask your admin to add the store
          coordinates before you can clock in.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Location status */}
          <div className="rounded-xl border border-border p-4 bg-surface-hover/40">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  Location check
                  {geo.status === "ok" && (
                    <Badge variant={inRange ? "success" : "danger"}>
                      {inRange ? "In range" : "Out of range"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {geo.status === "loading"
                    ? "Getting your location…"
                    : geo.status === "ok"
                      ? geo.distance != null
                        ? `${Math.round(geo.distance)}m from ${store?.name ?? "store"} · ±${Math.round(geo.accuracy)}m GPS accuracy`
                        : "No store location configured."
                      : geo.status === "denied" || geo.status === "error"
                        ? geo.message
                        : `You must be within ${store?.geofence_radius_m ?? 250}m of ${store?.name ?? "your store"}.`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={requestLocation}
                loading={geo.status === "loading"}
              >
                {geo.status === "ok" ? "Refresh" : "Retry"}
              </Button>
            </div>
          </div>

          {phase === "done" ? (
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
              <div className="flex items-center justify-between gap-2 font-medium">
                <span className="flex items-center gap-2">
                  <ClockIcon size={16} /> Shift logged for today
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {workedToday.toFixed(2)}h
                </span>
              </div>
              <p className="text-xs mt-1 text-success/80">
                Clocked in {formatTimeOnly(todayClock?.clock_in_at)} · Clocked out{" "}
                {formatTimeOnly(todayClock?.clock_out_at)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full text-base h-14"
                variant={phase === "out" ? "secondary" : "primary"}
                onClick={act}
                loading={busy}
                disabled={!inRange || busy}
                iconLeft={<ClockIcon size={18} />}
              >
                {phase === "out" ? "Clock Out Now" : "Clock In Now"}
              </Button>
              {!inRange && geo.status === "ok" && (
                <p className="text-xs text-danger text-center">
                  You&apos;re too far from {store?.name ?? "your store"} to clock {phase === "out" ? "out" : "in"}.
                </p>
              )}
              {phase === "out" && (
                <p className="text-[11px] text-text-muted text-center">
                  Clocked in at {formatTimeOnly(todayClock?.clock_in_at)}.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
