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
  clockedHours,
  formatDDMMYYYY,
  formatShiftRange,
  formatTimeOnly,
  haversineMeters,
  isWithinGeofence,
  startOfISOWeek,
  toISODate,
  todayISO,
  weekdayIndex,
} from "@/lib/utils";
import { ClockIcon } from "@/components/ui/icons";
import type {
  ClockEvent,
  Employee,
  EmployeeScheduleDay,
  RotaShift,
  Store,
} from "@/lib/types";
import { hasRole } from "@/lib/types";

type Props = {
  employee: Employee;
  store: Store | null;
  weekShifts: RotaShift[];
  schedules?: EmployeeScheduleDay[];
  todayClock: ClockEvent | null;
  /** This week's clock events (Mon–Sun) — drives the worked-hours history. */
  weekClocks?: ClockEvent[];
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
  schedules = [],
  todayClock,
  weekClocks = [],
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [geo, setGeo] = React.useState<GeoState>({ status: "idle" });
  const [busy, setBusy] = React.useState(false);
  const [shortDeliveries, setShortDeliveries] = React.useState<string>(
    todayClock?.short_deliveries_count?.toString() ?? "",
  );
  const [longDeliveries, setLongDeliveries] = React.useState<string>(
    todayClock?.long_deliveries_count?.toString() ?? "",
  );
  const [extraShort, setExtraShort] = React.useState<string>(
    todayClock?.extra_short_deliveries ? String(todayClock.extra_short_deliveries) : "",
  );
  const [extraLong, setExtraLong] = React.useState<string>(
    todayClock?.extra_long_deliveries ? String(todayClock.extra_long_deliveries) : "",
  );
  const [extraShortReason, setExtraShortReason] = React.useState<string>(
    todayClock?.extra_short_reason ?? "",
  );
  const [extraLongReason, setExtraLongReason] = React.useState<string>(
    todayClock?.extra_long_reason ?? "",
  );

  const today = todayISO();
  const isDriver = hasRole(employee.position, "Driver");
  const weekStart = startOfISOWeek(new Date());

  const scheduleByWeekday = React.useMemo(() => {
    const m = new Map<number, EmployeeScheduleDay>();
    for (const s of schedules) m.set(s.weekday, s);
    return m;
  }, [schedules]);

  // Clock events keyed by date, plus the week's worked-hours total (completed
  // shifts only — an in-progress shift is shown per-day but not yet summed).
  const clockByDate = React.useMemo(() => {
    const m = new Map<string, ClockEvent>();
    for (const c of weekClocks) m.set(c.event_date, c);
    return m;
  }, [weekClocks]);

  const weekWorkedHours = React.useMemo(
    () =>
      weekClocks.reduce(
        (sum, c) => sum + (c.clock_out_at ? clockedHours(c.clock_in_at, c.clock_out_at) : 0),
        0,
      ),
    [weekClocks],
  );

  const todayWorkedHours = todayClock?.clock_out_at
    ? clockedHours(todayClock.clock_in_at, todayClock.clock_out_at)
    : 0;

  // Effective shift for a date: published rota row first, else the employee's
  // recurring schedule template for that weekday.
  function effFor(dateIso: string, weekdayIdx: number) {
    const real = weekShifts.find((s) => s.shift_date === dateIso);
    if (real)
      return {
        is_day_off: real.is_day_off,
        start: real.start_time,
        end: real.end_time,
        reason: real.same_day_edit_reason,
        fromTemplate: false,
      };
    const tmpl = scheduleByWeekday.get(weekdayIdx);
    if (tmpl && tmpl.is_working && tmpl.start_time)
      return {
        is_day_off: false,
        start: tmpl.start_time,
        end: tmpl.end_time,
        reason: null,
        fromTemplate: true,
      };
    return null;
  }

  const todayEff = effFor(today, weekdayIndex(new Date()));

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
    if (isDriver && !shortDeliveries.trim() && !longDeliveries.trim()) {
      toast.error("Enter your short and long delivery counts before clocking out.");
      return;
    }
    if (isDriver && Number(extraShort) > 0 && !extraShortReason.trim()) {
      toast.error("Please give a reason for the extra short deliveries.");
      return;
    }
    if (isDriver && Number(extraLong) > 0 && !extraLongReason.trim()) {
      toast.error("Please give a reason for the extra long deliveries.");
      return;
    }
    setBusy(true);
    try {
      await clockOut({
        latitude: geo.lat,
        longitude: geo.lng,
        accuracy: geo.accuracy,
        short_deliveries_count: isDriver ? Number(shortDeliveries) || 0 : null,
        long_deliveries_count: isDriver ? Number(longDeliveries) || 0 : null,
        extra_short_deliveries: isDriver ? Number(extraShort) || 0 : null,
        extra_long_deliveries: isDriver ? Number(extraLong) || 0 : null,
        extra_short_reason: isDriver ? extraShortReason.trim() || null : null,
        extra_long_reason: isDriver ? extraLongReason.trim() || null : null,
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
    if (!shortDeliveries.trim() && !longDeliveries.trim()) return;
    if (Number(extraShort) > 0 && !extraShortReason.trim()) {
      toast.error("Please give a reason for the extra short deliveries.");
      return;
    }
    if (Number(extraLong) > 0 && !extraLongReason.trim()) {
      toast.error("Please give a reason for the extra long deliveries.");
      return;
    }
    setBusy(true);
    try {
      await updateDeliveryCount({
        short_count: Number(shortDeliveries) || 0,
        long_count: Number(longDeliveries) || 0,
        extra_short_deliveries: Number(extraShort) || 0,
        extra_long_deliveries: Number(extraLong) || 0,
        extra_short_reason: extraShortReason.trim() || null,
        extra_long_reason: extraLongReason.trim() || null,
      });
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
              {todayEff
                ? todayEff.is_day_off
                  ? `Marked as Day Off${store?.name ? ` at ${store.name}` : ""} — clock in only if you're covering.`
                  : `Scheduled ${formatShiftRange(false, todayEff.start, todayEff.end)} at ${store?.name ?? "your store"}${todayEff.fromTemplate ? " (your default schedule)" : ""}`
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
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span className="flex items-center gap-2">
                    <ClockIcon size={16} /> Shift complete for today
                  </span>
                  <span className="text-base font-semibold tabular-nums">
                    {todayWorkedHours.toFixed(2)}h
                  </span>
                </div>
                <p className="text-xs mt-1 text-success/80">
                  You worked {todayWorkedHours.toFixed(2)}h — clocked in{" "}
                  {formatTimeOnly(todayClock?.clock_in_at)} · clocked out{" "}
                  {formatTimeOnly(todayClock?.clock_out_at)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Drivers enter short + long deliveries before clocking out */}
                {phase === "out" && isDriver && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        label="Short deliveries *"
                        value={shortDeliveries}
                        onChange={(e) => setShortDeliveries(e.target.value)}
                        placeholder="0"
                      />
                      <Input
                        type="number"
                        min="0"
                        label="Long deliveries *"
                        value={longDeliveries}
                        onChange={(e) => setLongDeliveries(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        label="Extra short (beyond round)"
                        value={extraShort}
                        onChange={(e) => setExtraShort(e.target.value)}
                        placeholder="0"
                      />
                      <Input
                        type="number"
                        min="0"
                        label="Extra long (beyond round)"
                        value={extraLong}
                        onChange={(e) => setExtraLong(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    {Number(extraShort) > 0 && (
                      <Input
                        label="Reason for extra short deliveries *"
                        value={extraShortReason}
                        onChange={(e) => setExtraShortReason(e.target.value)}
                        placeholder="e.g. covered a second area after a no-show"
                        maxLength={200}
                      />
                    )}
                    {Number(extraLong) > 0 && (
                      <Input
                        label="Reason for extra long deliveries *"
                        value={extraLongReason}
                        onChange={(e) => setExtraLongReason(e.target.value)}
                        placeholder="e.g. out-of-area drop-off"
                        maxLength={200}
                      />
                    )}
                  </>
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="0"
                    label="Short so far"
                    value={shortDeliveries}
                    onChange={(e) => setShortDeliveries(e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    label="Long so far"
                    value={longDeliveries}
                    onChange={(e) => setLongDeliveries(e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    label="Extra short"
                    value={extraShort}
                    onChange={(e) => setExtraShort(e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    label="Extra long"
                    value={extraLong}
                    onChange={(e) => setExtraLong(e.target.value)}
                  />
                </div>
                {Number(extraShort) > 0 && (
                  <Input
                    label="Reason for extra short deliveries *"
                    value={extraShortReason}
                    onChange={(e) => setExtraShortReason(e.target.value)}
                    placeholder="e.g. covered a second area after a no-show"
                    maxLength={200}
                    containerClassName="mt-2"
                  />
                )}
                {Number(extraLong) > 0 && (
                  <Input
                    label="Reason for extra long deliveries *"
                    value={extraLongReason}
                    onChange={(e) => setExtraLongReason(e.target.value)}
                    placeholder="e.g. out-of-area drop-off"
                    maxLength={200}
                    containerClassName="mt-2"
                  />
                )}
                <Button onClick={saveLiveDeliveries} loading={busy} className="mt-3 w-full">
                  Update
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---------- Week shifts ---------- */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-5 pt-5 flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Your week</CardTitle>
            <CardDescription>
              {formatDDMMYYYY(weekStart)} – {formatDDMMYYYY(addDays(weekStart, 6))}. Your scheduled shift and the hours you actually worked.
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Worked this week
            </div>
            <div className="text-lg font-semibold text-gold tabular-nums">
              {weekWorkedHours.toFixed(2)}h
            </div>
          </div>
        </CardHeader>
        <div className="border-t border-border">
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(weekStart, i);
            const dateIso = toISODate(date);
            const eff = effFor(dateIso, i);
            const clk = clockByDate.get(dateIso);
            const worked = clk?.clock_out_at
              ? clockedHours(clk.clock_in_at, clk.clock_out_at)
              : 0;
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
                <div className="text-sm text-text-subtle text-right">
                  {eff
                    ? eff.is_day_off
                      ? <span className="text-danger">Day Off</span>
                      : <>
                          {formatShiftRange(false, eff.start, eff.end)}
                          {eff.reason && (
                            <span className="block text-[10px] text-warning mt-0.5">
                              {eff.reason}
                            </span>
                          )}
                          {eff.fromTemplate && (
                            <span className="block text-[10px] text-text-muted mt-0.5">
                              default schedule
                            </span>
                          )}
                        </>
                    : <span className="text-text-muted">No shift</span>}
                  {clk?.clock_in_at &&
                    (clk.clock_out_at ? (
                      <span className="block text-[11px] mt-0.5">
                        <span className="text-text-muted">
                          Worked {formatTimeOnly(clk.clock_in_at)}–{formatTimeOnly(clk.clock_out_at)}
                        </span>{" "}
                        <span className="text-success font-medium">{worked.toFixed(2)}h</span>
                      </span>
                    ) : (
                      <span className="block text-[11px] text-success mt-0.5">
                        On shift since {formatTimeOnly(clk.clock_in_at)}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
