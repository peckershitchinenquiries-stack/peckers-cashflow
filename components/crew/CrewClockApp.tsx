"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { clockIn, clockOut, updateDeliveryCount } from "@/app/actions/clock";
import {
  WEEKDAY_LONG,
  addDays,
  formatDDMMYYYY,
  formatShiftRange,
  formatTimeOnly,
  haversineMeters,
  isWithinGeofence,
  startOfISOWeek,
  toISODate,
  todayISO,
} from "@/lib/utils";
import { ClockIcon } from "@/components/ui/icons";
import type {
  ClockEvent,
  Employee,
  RotaShift,
  Store,
} from "@/lib/types";

type Props = {
  employee: Employee;
  store: Store | null;
  weekShifts: RotaShift[];
  todayClock: ClockEvent | null;
};

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number; accuracy: number; distance: number | null }
  | { status: "denied" | "error"; message: string };

export function CrewClockApp({
  employee,
  store,
  weekShifts,
  todayClock,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [geo, setGeo] = React.useState<GeoState>({ status: "idle" });
  const [busy, setBusy] = React.useState(false);
  const [deliveries, setDeliveries] = React.useState<string>(
    todayClock?.deliveries_count?.toString() ?? "",
  );

  const today = todayISO();
  const todayShift = weekShifts.find((s) => s.shift_date === today);
  const isDriver = employee.position === "Driver";
  const weekStart = startOfISOWeek(new Date());

  const storeConfigured = store?.latitude != null && store?.longitude != null;

  const requestLocation = React.useCallback(() => {
    setGeo({ status: "loading" });
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ status: "error", message: "Geolocation not supported by this device." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distance =
          store?.latitude != null && store?.longitude != null
            ? haversineMeters(
                Number(store.latitude),
                Number(store.longitude),
                pos.coords.latitude,
                pos.coords.longitude,
              )
            : null;
        setGeo({
          status: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          distance,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeo({
            status: "denied",
            message: "Location permission denied. Enable it in your browser settings, then tap Retry.",
          });
        } else {
          setGeo({ status: "error", message: err.message || "Could not get your location. Tap Retry." });
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }, [store?.latitude, store?.longitude]);

  // Capture location automatically when the page opens so the clock button is
  // ready immediately (it triggers the browser's permission prompt once).
  React.useEffect(() => {
    if (storeConfigured) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doClockIn() {
    if (geo.status !== "ok") {
      toast.error("Capture your location first.");
      return;
    }
    setBusy(true);
    try {
      await clockIn({ latitude: geo.lat, longitude: geo.lng, accuracy: geo.accuracy });
      toast.success("Clocked in. Have a good shift!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function doClockOut() {
    if (geo.status !== "ok") {
      toast.error("Capture your location first.");
      return;
    }
    if (isDriver && !deliveries.trim()) {
      toast.error("Enter your delivery count before clocking out.");
      return;
    }
    setBusy(true);
    try {
      await clockOut({
        latitude: geo.lat,
        longitude: geo.lng,
        accuracy: geo.accuracy,
        deliveries_count: isDriver ? Number(deliveries) : null,
      });
      toast.success("Clocked out. Thanks!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveLiveDeliveries() {
    if (!deliveries.trim()) return;
    setBusy(true);
    try {
      await updateDeliveryCount({ count: Number(deliveries) });
      toast.success("Live delivery count updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const inRange =
    geo.status === "ok" &&
    store?.geofence_radius_m != null &&
    geo.distance != null &&
    isWithinGeofence(geo.distance, store.geofence_radius_m, geo.accuracy);

  const clockedIn = !!todayClock?.clock_in_at && !todayClock?.clock_out_at;
  const clockedOut = !!todayClock?.clock_out_at;
  const notStarted = !todayClock?.clock_in_at;

  // What the big action button should do right now.
  const phase: "in" | "out" | "done" = clockedOut ? "done" : clockedIn ? "out" : "in";

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Primary clock card (always visible, in focus) ---------- */}
      <Card className="border-gold/30">
        <CardHeader>
          <div>
            <CardTitle>Today &mdash; {formatDDMMYYYY(new Date())}</CardTitle>
            <CardDescription>
              {todayShift
                ? todayShift.is_day_off
                  ? `Marked as Day Off${store?.name ? ` at ${store.name}` : ""} — clock in only if you're covering.`
                  : `Scheduled ${formatShiftRange(false, todayShift.start_time, todayShift.end_time)} at ${store?.name ?? "your store"}`
                : `No shift scheduled today${store?.name ? ` at ${store.name}` : ""}. You can still clock in if you're working.`}
            </CardDescription>
          </div>
        </CardHeader>

        {!employee.store_id ? (
          <p className="text-sm text-danger">
            You&apos;re not assigned to a store yet. Ask your manager to set your store.
          </p>
        ) : !storeConfigured ? (
          <p className="text-sm text-danger">
            Your store&apos;s location hasn&apos;t been set up yet. Ask your admin to add the
            store coordinates before you can clock in.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Status row */}
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

            {/* Big primary action */}
            {phase === "done" ? (
              <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                <div className="flex items-center gap-2 font-medium">
                  <ClockIcon size={16} /> Shift complete for today
                </div>
                <p className="text-xs mt-1 text-success/80">
                  Clocked in {formatTimeOnly(todayClock?.clock_in_at)} · Clocked out{" "}
                  {formatTimeOnly(todayClock?.clock_out_at)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Drivers enter deliveries before clocking out */}
                {phase === "out" && isDriver && (
                  <Input
                    type="number"
                    min="0"
                    label="Deliveries today *"
                    value={deliveries}
                    onChange={(e) => setDeliveries(e.target.value)}
                    placeholder="0"
                  />
                )}

                <Button
                  size="lg"
                  className="w-full text-base h-14"
                  variant={phase === "out" ? "secondary" : "primary"}
                  onClick={phase === "out" ? doClockOut : doClockIn}
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
                {geo.status === "ok" && (
                  <p className="text-[11px] text-text-muted text-center">
                    {phase === "out"
                      ? `Clocked in at ${formatTimeOnly(todayClock?.clock_in_at)}.`
                      : "Tip: tap Refresh if you've just arrived and you're showing out of range."}
                  </p>
                )}
              </div>
            )}

            {/* Driver live-count refresh (during shift) */}
            {isDriver && clockedIn && (
              <div className="rounded-xl border border-border p-4">
                <div className="text-sm font-medium mb-1">Live delivery count</div>
                <p className="text-xs text-text-muted">
                  Update during your shift &mdash; cross-checked against Vita Mojo by your
                  manager.
                </p>
                <div className="mt-3 flex items-end gap-2">
                  <Input
                    type="number"
                    min="0"
                    label="Deliveries so far"
                    value={deliveries}
                    onChange={(e) => setDeliveries(e.target.value)}
                    containerClassName="flex-1"
                  />
                  <Button onClick={saveLiveDeliveries} loading={busy}>
                    Update
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---------- Week shifts ---------- */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-5 pt-5">
          <div>
            <CardTitle>Your week</CardTitle>
            <CardDescription>
              {formatDDMMYYYY(weekStart)} – {formatDDMMYYYY(addDays(weekStart, 6))}. Updates in real time when the manager edits the rota.
            </CardDescription>
          </div>
        </CardHeader>
        <div className="border-t border-border">
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(weekStart, i);
            const dateIso = toISODate(date);
            const shift = weekShifts.find((s) => s.shift_date === dateIso);
            const isToday = dateIso === today;
            return (
              <div
                key={dateIso}
                className={
                  "px-5 py-3 border-b border-border last:border-0 flex items-center justify-between " +
                  (isToday ? "bg-gold/5" : "")
                }
              >
                <div>
                  <div className="text-sm font-medium">
                    {WEEKDAY_LONG[i]}{" "}
                    <span className="text-text-muted text-xs ml-1">
                      {formatDDMMYYYY(date)}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-text-subtle">
                  {shift
                    ? shift.is_day_off
                      ? <span className="text-danger">Day Off</span>
                      : <>
                          {formatShiftRange(false, shift.start_time, shift.end_time)}
                          {shift.same_day_edit_reason && (
                            <span className="block text-[10px] text-warning mt-0.5">
                              {shift.same_day_edit_reason}
                            </span>
                          )}
                        </>
                    : <span className="text-text-muted">No shift</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
