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

  function requestLocation() {
    setGeo({ status: "loading" });
    if (!navigator.geolocation) {
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
            message: "Location permission denied. Enable it in your browser to clock in.",
          });
        } else {
          setGeo({ status: "error", message: err.message || "Could not get location." });
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  async function doClockIn() {
    if (geo.status !== "ok") {
      toast.error("Capture your location first.");
      return;
    }
    setBusy(true);
    try {
      await clockIn({ latitude: geo.lat, longitude: geo.lng });
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
    geo.distance <= store.geofence_radius_m;

  const clockedIn = !!todayClock?.clock_in_at && !todayClock?.clock_out_at;
  const clockedOut = !!todayClock?.clock_out_at;

  return (
    <div className="flex flex-col gap-5">
      {/* Today card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Today &mdash; {formatDDMMYYYY(new Date())}</CardTitle>
            <CardDescription>
              {todayShift
                ? todayShift.is_day_off
                  ? "Marked as Day Off"
                  : `Scheduled ${formatShiftRange(false, todayShift.start_time, todayShift.end_time)} at ${store?.name ?? "—"}`
                : "No shift scheduled. Contact your manager."}
            </CardDescription>
          </div>
        </CardHeader>

        {todayShift && !todayShift.is_day_off && (
          <div className="flex flex-col gap-4">
            {/* Location capture */}
            <div className="rounded-xl border border-border p-4 bg-surface-hover/40">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-medium">Location</div>
                  <p className="text-xs text-text-muted">
                    Required &mdash; you must be at {store?.name ?? "the store"} to clock in or out.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestLocation}
                  loading={geo.status === "loading"}
                >
                  {geo.status === "ok" ? "Refresh" : "Get my location"}
                </Button>
              </div>

              {geo.status === "ok" && (
                <div className="mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant={inRange ? "success" : "danger"}>
                      {inRange ? "In range" : "Out of range"}
                    </Badge>
                    <span className="text-text-muted">
                      {geo.distance != null
                        ? `${Math.round(geo.distance)}m from ${store?.name ?? "store"}`
                        : "No store location configured"}
                      &nbsp;· ±{Math.round(geo.accuracy)}m accuracy
                    </span>
                  </div>
                </div>
              )}

              {(geo.status === "denied" || geo.status === "error") && (
                <p className="text-xs text-danger mt-3">{geo.message}</p>
              )}
            </div>

            {/* Clock-in / clock-out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <ClockIcon size={16} /> Clock In
                </div>
                <p className="text-xs text-text-muted">
                  {todayClock?.clock_in_at
                    ? `Logged at ${formatTimeOnly(todayClock.clock_in_at)}`
                    : "Not clocked in yet."}
                </p>
                {!todayClock?.clock_in_at && (
                  <Button
                    className="mt-3 w-full"
                    onClick={doClockIn}
                    loading={busy}
                    disabled={geo.status !== "ok"}
                  >
                    Clock In Now
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <ClockIcon size={16} /> Clock Out
                </div>
                <p className="text-xs text-text-muted">
                  {todayClock?.clock_out_at
                    ? `Logged at ${formatTimeOnly(todayClock.clock_out_at)}`
                    : clockedIn
                      ? "Ready when you are."
                      : "Clock in first."}
                </p>

                {isDriver && clockedIn && !clockedOut && (
                  <Input
                    type="number"
                    min="0"
                    label="Deliveries today *"
                    value={deliveries}
                    onChange={(e) => setDeliveries(e.target.value)}
                    placeholder="0"
                    containerClassName="mt-3"
                  />
                )}

                {clockedIn && !clockedOut && (
                  <Button
                    className="mt-3 w-full"
                    variant="secondary"
                    onClick={doClockOut}
                    loading={busy}
                    disabled={geo.status !== "ok"}
                  >
                    Clock Out
                  </Button>
                )}
              </div>
            </div>

            {/* Driver live-count refresh */}
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

      {/* Week shifts */}
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
