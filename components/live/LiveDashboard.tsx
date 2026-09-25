"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  WEEKDAY_LONG,
  clockedHours,
  formatDDMMYYYY,
  formatGBP,
  formatHoursMinsWords,
  formatShiftRange,
  formatTimeOnly,
  liveDayWorkedHours,
  shiftHours,
  toISODate,
} from "@/lib/utils";
import type {
  AllowedUser,
  ClockEvent,
  CoverDriver,
  CoverDriverClockEvent,
  CoverDriverScheduleDay,
  CoverDriverShift,
  EmployeeScheduleDay,
  LiveClockSession,
  LiveDashboardStatus,
  LiveEmployee,
  ManagerClockEvent,
  ManagerClockSession,
  ManagerShift,
  RotaShift,
  Store,
} from "@/lib/types";
import { hasRole } from "@/lib/types";
import {
  coverDriverPay,
  resolveCoverDriverShift,
  totalDeliveries,
} from "@/lib/cover-driver-hours";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PlusIcon } from "@/components/ui/icons";
import {
  ManualClockEntryModal,
  type ManualEntryCandidate,
} from "@/components/clock/ManualClockEntryModal";
import { LivePersonCard } from "@/components/live/LivePersonCard";

type Props = {
  stores: Store[];
  employees: LiveEmployee[];
  shifts: RotaShift[];
  clocks: ClockEvent[];
  /** Recurring weekly templates — used as the fallback "expected" shift when no
   *  rota row is published for today (so missed shifts still show). */
  schedules?: EmployeeScheduleDay[];
  /** Manager login accounts (allowed_users, role=manager) for attendance. */
  managers?: AllowedUser[];
  /** Today's individual shifts, keyed by clock_events.id — a day can hold several. */
  clockSessions?: LiveClockSession[];
  /** Today's manager clock rows, keyed on the login account. */
  managerClocks?: ManagerClockEvent[];
  /** Today's individual manager shifts — a manager's day can hold several. */
  managerClockSessions?: ManagerClockSession[];
  /** Today's manager rota shifts — used to place a manager scheduled to cover
   *  another store under that store before they've clocked in. */
  managerShifts?: ManagerShift[];
  /** Cover drivers. The board's cover section is hidden entirely when a store
   *  has none — most stores only use them at weekends. */
  coverDrivers?: CoverDriver[];
  coverDriverClocks?: CoverDriverClockEvent[];
  coverDriverShifts?: CoverDriverShift[];
  coverDriverSchedules?: CoverDriverScheduleDay[];
  /**
   * Show the "Add clock-in" buttons. Passed from /manager/live and admin /live
   * — gated on an explicit prop rather than `userRole`, so reusing this
   * component elsewhere can't silently switch a pay-affecting write back on.
   * The button sits on each store's card and records against THAT store, so an
   * admin seeing both stores gets one per card.
   */
  canAddClockIn?: boolean;
  /**
   * Show "Add manager clock-in" as well. A separate prop from `canAddClockIn`
   * on purpose: a manager's day carries their fixed daily wage, so recording
   * one is admin work, and the manager board stays exactly as it was.
   */
  canAddManagerClockIn?: boolean;
  /** Server's "today" as YYYY-MM-DD, for the manual-entry date. */
  todayISO?: string;
  userRole: string;
  userStoreId: string | null;
};

/** Minimal shape the dashboard needs from a shift (real or template-derived). */
type EffShift = {
  is_day_off: boolean;
  is_on_leave?: boolean;
  start_time: string | null;
  end_time: string | null;
};

type MobileFilter = "all" | "working" | "due" | "done" | "off";
const ALL_STATUSES: LiveDashboardStatus[] = [
  "on_shift", "expected", "late", "clocked_out", "day_off", "on_leave", "tbc", "absent",
];
const MOBILE_FILTERS: { id: MobileFilter; label: string; statuses: LiveDashboardStatus[] }[] = [
  { id: "all", label: "All", statuses: ALL_STATUSES },
  { id: "working", label: "On shift", statuses: ["on_shift"] },
  { id: "due", label: "Due / Late", statuses: ["expected", "late", "absent"] },
  { id: "done", label: "Clocked out", statuses: ["clocked_out"] },
  { id: "off", label: "Off", statuses: ["day_off", "on_leave", "tbc"] },
];

const STATUS_STYLES: Record<LiveDashboardStatus, { label: string; cls: string }> = {
  on_shift: { label: "On Shift", cls: "bg-success/15 text-success border-success/40" },
  expected: { label: "Expected", cls: "bg-warning/15 text-warning border-warning/40" },
  late: { label: "Late", cls: "bg-warning/30 text-warning border-warning/60" },
  clocked_out: {
    label: "Clocked Out",
    cls: "bg-surface-hover text-text-subtle border-border",
  },
  day_off: { label: "Day Off", cls: "bg-danger/10 text-danger border-danger/30" },
  on_leave: { label: "On Leave", cls: "bg-warning/10 text-warning border-warning/30" },
  tbc: { label: "TBC", cls: "bg-surface-hover text-text-muted border-border" },
  absent: { label: "Absent", cls: "bg-danger/20 text-danger border-danger/60" },
};

const ROW_BG: Record<LiveDashboardStatus, string> = {
  on_shift: "bg-success/5",
  expected: "bg-warning/5",
  late: "bg-warning/10",
  clocked_out: "",
  day_off: "bg-danger/5",
  on_leave: "bg-warning/5",
  tbc: "",
  absent: "bg-danger/10",
};

/**
 * Only the two timestamps are read, so this is typed structurally rather than
 * as ClockEvent — that lets cover_driver_clock_events reuse the exact same
 * late/absent thresholds instead of a second copy that could drift.
 */
type ClockLike = { clock_in_at: string | null; clock_out_at: string | null };

function computeStatus(
  shift: EffShift | null | undefined,
  clock: ClockLike | null | undefined,
  now: Date,
): LiveDashboardStatus {
  if (!shift) return "tbc";
  if (shift.is_day_off) return shift.is_on_leave ? "on_leave" : "day_off";
  if (clock?.clock_out_at) return "clocked_out";
  if (clock?.clock_in_at) return "on_shift";
  if (!shift.start_time) return "tbc";
  const [h, m] = shift.start_time.split(":").map(Number);
  const sched = new Date(now);
  sched.setHours(h, m, 0, 0);
  const diffMin = (now.getTime() - sched.getTime()) / 60000;
  if (diffMin > 60) return "absent";
  if (diffMin > 15) return "late";
  return "expected";
}

/**
 * The shift cell for one store. A store can hold two bookings on the same day
 * ("12:00–17:00, 18:00–21:00"), so one range would hide the second.
 */
function bookedShiftLabel(
  storeShifts: RotaShift[],
  fallback: EffShift | null,
): string {
  const working = storeShifts.filter((s) => !s.is_day_off);
  if (working.length > 1)
    return working
      .map((s) => formatShiftRange(false, s.start_time, s.end_time))
      .join(", ");
  return formatShiftRange(
    fallback?.is_day_off ?? false,
    fallback?.start_time ?? null,
    fallback?.end_time ?? null,
    fallback?.is_on_leave,
  );
}

/** "09:00–13:00, 17:00–now" — the sessions actually clocked at this store. */
function sessionsLabel(sessions: { clock_in_at: string; clock_out_at: string | null }[]): string {
  return sessions
    .map(
      (s) =>
        `${formatTimeOnly(s.clock_in_at)}–${s.clock_out_at ? formatTimeOnly(s.clock_out_at) : "now"}`,
    )
    .join(", ");
}

/** Gross hourly rate used to value a day's wage (on-the-books NI rate). */
function rateOf(emp: LiveEmployee): number {
  return Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0) || 0;
}

/** Attendance status for a manager from their clock row. */
type ManagerStatus = "on_shift" | "clocked_out" | "not_in";
function managerStatusOf(mc: ManagerClockEvent | null | undefined): ManagerStatus {
  if (mc?.clock_out_at) return "clocked_out";
  if (mc?.clock_in_at) return "on_shift";
  return "not_in";
}
const MANAGER_STATUS: Record<ManagerStatus, { label: string; cls: string }> = {
  on_shift: { label: "On Shift", cls: "bg-success/15 text-success border-success/40" },
  clocked_out: { label: "Clocked Out", cls: "bg-surface-hover text-text-subtle border-border" },
  not_in: { label: "Not clocked in", cls: "bg-warning/15 text-warning border-warning/40" },
};

export function LiveDashboard({
  stores,
  employees,
  shifts,
  clocks,
  clockSessions = [],
  schedules = [],
  managers = [],
  managerClocks = [],
  managerClockSessions = [],
  managerShifts = [],
  coverDrivers = [],
  coverDriverClocks = [],
  coverDriverShifts = [],
  coverDriverSchedules = [],
  canAddClockIn = false,
  canAddManagerClockIn = false,
  todayISO: todayIsoProp,
  userRole,
  userStoreId,
}: Props) {
  const router = useRouter();
  const [adding, setAdding] = React.useState<{
    mode: "employee" | "cover_driver" | "manager";
    storeId: string;
  } | null>(null);
  const [now, setNow] = React.useState<Date>(() => new Date());
  // Phone-only finder: the board runs to dozens of cards, so narrow it by name or status.
  const [mobileQuery, setMobileQuery] = React.useState("");
  const [mobileFilter, setMobileFilter] = React.useState<MobileFilter>("all");
  const mobileNeedle = mobileQuery.trim().toLowerCase();
  const mobileFiltering = mobileNeedle !== "" || mobileFilter !== "all";
  const showOnMobile = (name: string, status: LiveDashboardStatus) =>
    (mobileNeedle === "" || name.toLowerCase().includes(mobileNeedle)) &&
    MOBILE_FILTERS.find((f) => f.id === mobileFilter)!.statuses.includes(status);

  // Local clock ticks every 30s so the "updated HH:MM" label and time-based
  // statuses (late/absent) stay fresh without hitting the server.
  React.useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Server data refresh runs every 30 seconds, and only while the tab is
  // visible — keeps the board "live" without hammering Supabase on idle tabs.
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), 30_000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [router]);

  const isSuperAdmin = userRole === "admin";

  const visibleStores = stores.filter((s) =>
    isSuperAdmin || !userStoreId ? true : s.id === userStoreId,
  );

  // Phone-only: one store at a time, so the second store isn't buried below the first.
  const [mobileStoreId, setMobileStoreId] = React.useState<string>(
    () =>
      (visibleStores.find((s) => s.id === userStoreId) ?? visibleStores[0])?.id ?? "",
  );
  const activeMobileStoreId = visibleStores.some((s) => s.id === mobileStoreId)
    ? mobileStoreId
    : visibleStores[0]?.id ?? "";

  // A day can hold SEVERAL booked shifts (migration 032), and they need not be
  // at the same store — 12:00–17:00 at one, 17:00–23:00 at the other. Keyed by
  // employee alone this was a Map that kept only the last row, so half a split
  // day vanished before anything downstream ever saw it.
  const shiftsByEmp = new Map<string, RotaShift[]>();
  for (const s of shifts) {
    const arr = shiftsByEmp.get(s.employee_id) ?? [];
    arr.push(s);
    shiftsByEmp.set(s.employee_id, arr);
  }
  for (const arr of shiftsByEmp.values())
    arr.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const shiftsByEmpStore = new Map<string, RotaShift[]>();
  for (const [empId, arr] of shiftsByEmp)
    for (const s of arr) {
      const k = `${empId}:${s.store_id}`;
      shiftsByEmpStore.set(k, [...(shiftsByEmpStore.get(k) ?? []), s]);
    }
  const clockByEmp = new Map(clocks.map((c) => [c.employee_id, c]));
  // The day's individual shifts, per employee. The clock row above is the day's
  // header: its In is the FIRST clock-in and its Out the last, so hours have to
  // come from the sessions or a split day would bill the gap between shifts.
  const sessionsByEmp = new Map<string, LiveClockSession[]>();
  for (const s of clockSessions) {
    const arr = sessionsByEmp.get(s.employee_id) ?? [];
    arr.push(s);
    sessionsByEmp.set(s.employee_id, arr);
  }
  // By clock time, not seq — a shift recorded by a manager after the fact can
  // carry a higher seq than one that happened earlier in the day.
  for (const arr of sessionsByEmp.values())
    arr.sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at));
  // The header's store_id follows the open/latest shift (Update 98), so it
  // cannot say where the OTHER half of a cross-store day was worked. Each
  // store's card reads its own sessions instead.
  const sessionsByEmpStore = new Map<string, LiveClockSession[]>();
  for (const [empId, arr] of sessionsByEmp)
    for (const s of arr) {
      if (!s.store_id) continue;
      const k = `${empId}:${s.store_id}`;
      sessionsByEmpStore.set(k, [...(sessionsByEmpStore.get(k) ?? []), s]);
    }
  const managerClockByMgr = new Map(managerClocks.map((mc) => [mc.manager_id, mc]));
  // Same treatment as employees: the clock row is the day's header, so a
  // manager's worked hours have to come from the sessions or a split day would
  // count the gap between the morning and evening shifts.
  const managerSessionsByMgr = new Map<string, ManagerClockSession[]>();
  for (const s of managerClockSessions) {
    // A deliveries-only row (migration 037) carries drops for a day the manager
    // never clocked. It is not a shift: counting it would show a "×2 shifts"
    // marker and a window nobody worked.
    if (s.deliveries_only) continue;
    const arr = managerSessionsByMgr.get(s.manager_id) ?? [];
    arr.push(s);
    managerSessionsByMgr.set(s.manager_id, arr);
  }
  for (const arr of managerSessionsByMgr.values())
    arr.sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at));
  const managerShiftByMgr = new Map(managerShifts.map((s) => [s.manager_id, s]));

  const storeById = new Map(stores.map((s) => [s.id, s]));

  /** An HH:MM rota time as today's wall-clock instant, for ordering shifts. */
  const schedTimeMs = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  // Which stores an employee belongs to TODAY — a SET, not one store. A day can
  // be split across both (Hitchin 12:00–17:00, then Stevenage 17:00–close), and
  // answering with a single store put the whole person on one card and left the
  // other store blind to a shift it was expecting.
  //
  // Every session worked today counts, plus every store booked on the rota, plus
  // the day header's own store (pre-029 rows carry no sessions). A worker with
  // nothing on today falls back to their home store, so they still show as TBC
  // or Day Off where they belong. Day-off rota cells place nobody: a booking
  // elsewhere is where they actually are.
  const todayStoresOf = (emp: LiveEmployee): string[] => {
    const out = new Set<string>();
    for (const s of sessionsByEmp.get(emp.id) ?? []) if (s.store_id) out.add(s.store_id);
    const c = clockByEmp.get(emp.id);
    if (c?.store_id) out.add(c.store_id);
    for (const s of shiftsByEmp.get(emp.id) ?? [])
      if (!s.is_day_off) out.add(s.store_id);
    if (out.size === 0 && emp.store_id) out.add(emp.store_id);
    return [...out];
  };

  // Same rule for a manager: the store they clocked in at today (source of truth
  // for where they actually are), else where they're scheduled to cover, else
  // their home store. Lets a manager covering another store show under it.
  const managerTodayStoreOf = (m: AllowedUser): string | null => {
    const c = managerClockByMgr.get(m.id);
    if (c?.store_id) return c.store_id;
    const s = managerShiftByMgr.get(m.id);
    if (s?.store_id && !s.is_day_off) return s.store_id;
    return m.store_id ?? null;
  };
  const scheduleByEmpDay = new Map(
    schedules.map((s) => [`${s.employee_id}:${s.weekday}`, s]),
  );
  const todayWeekday = (now.getDay() + 6) % 7;
  // Prefer the server's date so a client in another timezone can't file a
  // manual entry against the wrong day.
  const todayIso = todayIsoProp ?? toISODate(now);

  const coverClockByDriver = new Map(
    coverDriverClocks.map((c) => [c.cover_driver_id, c]),
  );
  const coverShiftByDriver = new Map(
    coverDriverShifts.map((s) => [s.cover_driver_id, s]),
  );
  const coverScheduleByDriverDay = new Map(
    coverDriverSchedules.map((s) => [`${s.cover_driver_id}:${s.weekday}`, s]),
  );

  // Same "where are they actually today" rule as staff: the store they clocked
  // in at wins, then the rota cell, then their home store.
  const coverTodayStoreOf = (d: CoverDriver): string | null => {
    const c = coverClockByDriver.get(d.id);
    if (c?.store_id) return c.store_id;
    const s = coverShiftByDriver.get(d.id);
    if (s?.store_id && !s.is_day_off) return s.store_id;
    return d.store_id ?? null;
  };

  // Real published rota row for today, else the recurring template for today's
  // weekday — so an expected shift (and late/absent status) still shows even
  // when the manager hasn't published a rota.
  //
  // Scoped to ONE store: a cross-store day must not show its Hitchin booking on
  // the Stevenage card. The recurring template carries no store, so it only
  // stands in at the employee's HOME store.
  function effectiveShiftFor(
    empId: string,
    storeId: string,
    isHomeStore: boolean,
  ): { shift: EffShift | null; fromTemplate: boolean } {
    const real = shiftsByEmpStore.get(`${empId}:${storeId}`)?.[0];
    if (real) return { shift: real, fromTemplate: false };
    if (!isHomeStore) return { shift: null, fromTemplate: false };
    const tmpl = scheduleByEmpDay.get(`${empId}:${todayWeekday}`);
    if (tmpl && tmpl.is_working && tmpl.start_time) {
      return {
        shift: {
          is_day_off: false,
          start_time: tmpl.start_time,
          end_time: tmpl.end_time,
        },
        fromTemplate: true,
      };
    }
    return { shift: null, fromTemplate: false };
  }

  const today = new Date();
  const weekday = WEEKDAY_LONG[(today.getDay() + 6) % 7];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-text-muted">
        <span>{weekday}, {formatDDMMYYYY(today)}</span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
          Live · updated {formatTimeOnly(now.toISOString())}
        </span>
      </div>

      <div className="md:hidden sticky top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-20 -mx-4 px-4 py-2 bg-bg/95 backdrop-blur border-b border-border flex flex-col gap-2">
        <div className="relative">
          <input
            type="search"
            value={mobileQuery}
            onChange={(e) => setMobileQuery(e.target.value)}
            placeholder="Find a person…"
            aria-label="Find a person"
            className="w-full h-11 rounded-xl border border-border bg-surface px-3 text-base text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
          {MOBILE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setMobileFilter(f.id)}
              aria-pressed={mobileFilter === f.id}
              className={
                "shrink-0 h-8 px-3 rounded-full border text-xs font-medium transition-colors " +
                (mobileFilter === f.id
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border bg-surface text-text-subtle")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        {visibleStores.length > 1 && (
          <Select
            value={activeMobileStoreId}
            onChange={(e) => setMobileStoreId(e.target.value)}
          >
            {visibleStores.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
        {visibleStores.map((store) => {
          const storeEmployees = employees.filter(
            (e) =>
              e.employment_status === "active" && todayStoresOf(e).includes(store.id),
          );
          // This store's own staff who are working at ANOTHER store today, so the
          // store's manager can see where they've gone. Someone splitting the day
          // between both stores is NOT away — they're on the roster above, and
          // listing them here as well would read as if they never turned up.
          const awayStaff = employees
            .filter(
              (e) =>
                e.store_id === store.id &&
                e.employment_status === "active" &&
                !todayStoresOf(e).includes(store.id),
            )
            .map((e) => ({
              emp: e,
              atLabel:
                todayStoresOf(e)
                  .map((id) => storeById.get(id)?.name)
                  .filter(Boolean)
                  .join(" + ") || "another store",
            }))
            .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
          // Sort: manager first, then on-shift, then others
          const sorted = [...storeEmployees].sort((a, b) => {
            const pa = a.position === "Manager" ? 0 : 1;
            const pb = b.position === "Manager" ? 0 : 1;
            return pa - pb || a.name.localeCompare(b.name);
          });

          // Managers are login accounts (allowed_users), not employees — pulled
          // from their own table with their own clock rows. A manager shows under
          // the store they're actually at today (clocked in / scheduled to
          // cover), so a visiting manager appears here, not at their home store.
          const storeManagers = managers.filter(
            (m) => managerTodayStoreOf(m) === store.id,
          );
          // This store's own managers covering ANOTHER store today.
          const awayManagers = managers
            .filter(
              (m) => m.store_id === store.id && managerTodayStoreOf(m) !== store.id,
            )
            .map((m) => ({ mgr: m, at: storeById.get(managerTodayStoreOf(m) ?? "") ?? null }))
            .sort((a, b) =>
              (a.mgr.name || a.mgr.username || "").localeCompare(
                b.mgr.name || b.mgr.username || "",
              ),
            );

          // Per-employee daily wage: expected (scheduled hours × rate) and
          // actual (hours clocked so far × rate). Drives the table columns and
          // the store totals below.
          //
          // Everything below is scoped to THIS store. A day split across both
          // stores produces a row on each card carrying only that store's
          // booked shifts, sessions, hours, wage and drops — summing the whole
          // day on both would bill every cross-store shift twice.
          const wageRows = sorted.map((emp) => {
            const isHomeStore = emp.store_id === store.id;
            const { shift: firstShift, fromTemplate } = effectiveShiftFor(
              emp.id,
              store.id,
              isHomeStore,
            );
            const storeShifts = shiftsByEmpStore.get(`${emp.id}:${store.id}`) ?? [];
            const sessions = sessionsByEmpStore.get(`${emp.id}:${store.id}`) ?? [];
            const dayClock = clockByEmp.get(emp.id);
            // The header stands in only for a pre-029 day with no sessions, and
            // only on the store it is actually filed against.
            const headerHere =
              sessions.length === 0 && dayClock?.store_id === store.id ? dayClock : null;
            const openSession = sessions.find((x) => !x.clock_out_at) ?? null;
            const clock: ClockLike | null = sessions.length
              ? {
                  clock_in_at: sessions[0].clock_in_at,
                  clock_out_at: openSession
                    ? null
                    : sessions[sessions.length - 1].clock_out_at,
                }
              : headerHere
                ? {
                    clock_in_at: headerHere.clock_in_at,
                    clock_out_at: headerHere.clock_out_at,
                  }
                : null;

            // With two bookings here, status follows the one still to finish —
            // otherwise a morning already worked would keep reading "Clocked
            // Out" while the evening shift goes unnoticed.
            const upcoming = storeShifts.find(
              (x) => !x.is_day_off && x.end_time && schedTimeMs(x.end_time) > now.getTime(),
            );
            const shift: EffShift | null = upcoming ?? firstShift;
            // A finished earlier shift says nothing about one that hasn't
            // started, so it must not mark the next one as already done.
            const nextStartMs =
              !openSession && upcoming?.start_time ? schedTimeMs(upcoming.start_time) : null;
            const statusClock =
              nextStartMs != null &&
              sessions.length > 0 &&
              sessions.every(
                (x) => x.clock_out_at && new Date(x.clock_out_at).getTime() <= nextStartMs,
              )
                ? null
                : clock;
            const status = computeStatus(shift, statusClock, now);

            const rate = rateOf(emp);
            const expHours = storeShifts.length
              ? storeShifts.reduce(
                  (t, x) =>
                    t +
                    (x.is_day_off
                      ? 0
                      : Number(x.scheduled_hours) > 0
                        ? Number(x.scheduled_hours)
                        : shiftHours(x.start_time, x.end_time)),
                  0,
                )
              : shift && !shift.is_day_off
                ? shiftHours(shift.start_time, shift.end_time)
                : 0;
            const actHours = sessions.length
              ? sessions.reduce(
                  (t, x) => t + clockedHours(x.clock_in_at, x.clock_out_at, now),
                  0,
                )
              : headerHere
                ? liveDayWorkedHours(headerHere, undefined, now)
                : 0;
            // Drops come off the sessions worked HERE (migration 033); the day
            // header's totals are the sum across both stores.
            const deliveries = sessions.length
              ? sessions.reduce(
                  (t, x) =>
                    t +
                    (Number(x.short_deliveries_count) || 0) +
                    (Number(x.long_deliveries_count) || 0),
                  0,
                )
              : headerHere
                ? (Number(headerHere.short_deliveries_count) || 0) +
                  (Number(headerHere.long_deliveries_count) || 0)
                : null;
            const manualEntry = sessions.length
              ? sessions.some((x) => x.manual_entry)
              : (headerHere?.manual_entry ?? false);
            const manualReason = sessions.length
              ? (sessions.find((x) => x.manual_entry)?.manual_entry_reason ?? null)
              : (headerHere?.manual_entry_reason ?? null);

            return {
              emp,
              shift,
              // Clocked in HERE and not out again. Read off the clock rather
              // than the status, which is "tbc" for anyone working a shift
              // nobody booked.
              onShift: openSession != null ||
                Boolean(headerHere?.clock_in_at && !headerHere.clock_out_at),
              storeShifts,
              fromTemplate,
              clock,
              sessions,
              status,
              expHours,
              actHours,
              deliveries,
              manualEntry,
              manualReason,
              expectedWage: expHours * rate,
              actualWage: actHours * rate,
            };
          });
          const expectedTotal = wageRows.reduce((s, r) => s + r.expectedWage, 0);
          const actualTotal = wageRows.reduce((s, r) => s + r.actualWage, 0);
          // Counted off this store's rows: someone mid-shift at the other store
          // is not "on shift now" here.
          const onShiftCount = wageRows.filter((r) => r.onShift).length;

          // Managers are on a fixed daily wage (not hourly), and it only
          // counts once they've actually clocked in — no clock-in, no wage.
          // So expected and actual are the same figure for managers.
          const managerExpectedTotal = storeManagers.reduce((s, m) => {
            const mc = managerClockByMgr.get(m.id);
            return s + (mc?.clock_in_at ? Number(m.fixed_daily_wage) || 0 : 0);
          }, 0);
          const managerActualTotal = managerExpectedTotal;

          // Cover drivers: only those actually attached to this store today.
          // A store with none renders no cover section at all — most stores
          // only use cover drivers at weekends, so an empty block every weekday
          // would be noise.
          const storeCoverRows = coverDrivers
            .filter((d) => d.is_active && coverTodayStoreOf(d) === store.id)
            .map((driver) => {
              const clock = coverClockByDriver.get(driver.id) ?? null;
              const shift = resolveCoverDriverShift(
                coverShiftByDriver.get(driver.id),
                coverScheduleByDriverDay.get(`${driver.id}:${todayWeekday}`),
              );
              const status = computeStatus(shift, clock, now);
              const rate = Number(driver.hourly_cash_rate) || 0;
              const expHours =
                shift && !shift.is_day_off
                  ? shift.scheduled_hours && shift.scheduled_hours > 0
                    ? shift.scheduled_hours
                    : shiftHours(shift.start_time, shift.end_time)
                  : 0;
              const actHours = clockedHours(clock?.clock_in_at, clock?.clock_out_at, now);
              const shortD = totalDeliveries(
                clock?.short_deliveries_count,
                clock?.extra_short_deliveries,
              );
              const longD = totalDeliveries(
                clock?.long_deliveries_count,
                clock?.extra_long_deliveries,
              );
              return {
                driver,
                shift,
                clock,
                status,
                expHours,
                actHours,
                deliveries: shortD + longD,
                // Expected pay values hours only — deliveries aren't known until
                // they're done, so counting them here would inflate the forecast.
                expectedWage: expHours * rate,
                actualWage: coverDriverPay({
                  hours: actHours,
                  hourlyRate: rate,
                  shortDeliveries: shortD,
                  longDeliveries: longD,
                  shortRate: driver.short_delivery_rate,
                  longRate: driver.long_delivery_rate,
                }),
              };
            })
            .sort((a, b) => a.driver.name.localeCompare(b.driver.name));

          const coverExpectedTotal = storeCoverRows.reduce(
            (s, r) => s + r.expectedWage,
            0,
          );
          const coverActualTotal = storeCoverRows.reduce((s, r) => s + r.actualWage, 0);
          const hasCover = storeCoverRows.length > 0;

          const expectedGrandTotal =
            expectedTotal + managerExpectedTotal + coverExpectedTotal;
          const actualGrandTotal = actualTotal + managerActualTotal + coverActualTotal;

          return (
            // A plain div, not <Card>: `cn` is a bare join with no
            // tailwind-merge, so Card's own `p-5` outranks a passed `p-0` and
            // left a 20px moat around every section of the board.
            <div
              key={store.id}
              id={`live-store-${store.id}`}
              className={
                "rounded-2xl bg-surface border border-border overflow-hidden transition-colors max-md:scroll-mt-32" +
                (visibleStores.length > 1 && store.id !== activeMobileStoreId ? " max-md:hidden" : "")
              }
            >
              <div className="px-3 md:px-5 pt-3 md:pt-5 pb-3 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold tracking-wide break-words">
                      {store.name}
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5 sm:mt-1">
                      {sorted.length} scheduled · {onShiftCount} on shift now
                    </p>
                  </div>
                  {(canAddClockIn || canAddManagerClockIn) && (
                    <div className="flex flex-row sm:flex-col items-stretch gap-2 sm:shrink-0">
                      {canAddClockIn && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none sm:w-auto justify-center whitespace-nowrap"
                          iconLeft={<PlusIcon size={14} />}
                          onClick={() => setAdding({ mode: "employee", storeId: store.id })}
                          title="Record a clock-in for someone who forgot"
                        >
                          <span className={canAddManagerClockIn ? "sm:hidden" : "hidden"}>
                            Employee
                          </span>
                          <span className={canAddManagerClockIn ? "hidden sm:inline" : ""}>
                            Add employee clock-in
                          </span>
                        </Button>
                      )}
                      {canAddManagerClockIn && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none sm:w-auto justify-center whitespace-nowrap"
                          iconLeft={<PlusIcon size={14} />}
                          onClick={() => setAdding({ mode: "manager", storeId: store.id })}
                          title="Record a clock-in for a manager who forgot"
                        >
                          <span className="sm:hidden">Manager</span>
                          <span className="hidden sm:inline">Add manager clock-in</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Manager attendance — clock in/out for monitoring (fixed salary) */}
                {storeManagers.length > 0 && (
                  <div className="mt-3 rounded-lg border border-border bg-surface md:bg-surface-hover/50 px-2.5 py-2 md:p-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                      Manager attendance
                    </div>
                    <div className="flex flex-col gap-2">
                      {storeManagers.map((m) => {
                        const mc = managerClockByMgr.get(m.id);
                        const status = managerStatusOf(mc);
                        const style = MANAGER_STATUS[status];
                        const mgrSessions = managerSessionsByMgr.get(m.id);
                        const worked = mc?.clock_in_at
                          ? liveDayWorkedHours(mc, mgrSessions, now)
                          : 0;
                        const mgrShiftCount = mgrSessions?.length ?? 0;
                        // "09:00–13:00, 17:00–now" — hover detail so a second
                        // shift is never mistaken for one long unbroken day.
                        // The day's drop total, base + extras, straight off the
                        // header — which is the SUM of the day's shifts.
                        const mgrDrops =
                          (Number(mc?.short_deliveries_count) || 0) +
                          (Number(mc?.long_deliveries_count) || 0) +
                          (Number(mc?.extra_short_deliveries) || 0) +
                          (Number(mc?.extra_long_deliveries) || 0);
                        const mgrShiftsLabel = (mgrSessions ?? [])
                          .map(
                            (s) =>
                              `${formatTimeOnly(s.clock_in_at)}–${s.clock_out_at ? formatTimeOnly(s.clock_out_at) : "now"}`,
                          )
                          .join(", ");
                        return (
                          <div
                            key={m.id}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-text-primary truncate">
                                {m.name || m.username}
                                {m.store_id !== store.id && (
                                  <span
                                    className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gold/15 text-gold border border-gold/30 align-middle"
                                    title={`Covering — home store ${storeById.get(m.store_id ?? "")?.name ?? "elsewhere"}`}
                                  >
                                    visiting
                                  </span>
                                )}
                              </div>
                              {isSuperAdmin && m.fixed_daily_wage != null && (
                                <div className="text-[11px] text-text-muted">
                                  {formatGBP(m.fixed_daily_wage)} / day
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border " +
                                  style.cls
                                }
                              >
                                {style.label}
                              </span>
                              {mc?.clock_in_at && (
                                <div
                                  className="text-[11px] text-text-muted mt-0.5 tabular-nums"
                                  title={mgrShiftCount > 1 ? mgrShiftsLabel : undefined}
                                >
                                  In {formatTimeOnly(mc.clock_in_at)}
                                  {mc.clock_out_at
                                    ? ` · Out ${formatTimeOnly(mc.clock_out_at)}`
                                    : ""}{" "}
                                  · {formatHoursMinsWords(worked)}
                                  {mgrShiftCount > 1 && (
                                    <span
                                      className="ml-1 font-medium text-gold"
                                      title={`${mgrShiftCount} shifts today — ${mgrShiftsLabel}`}
                                    >
                                      ×{mgrShiftCount}
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* Drops a manager covered are real money, so
                                  they show here the moment they're logged —
                                  the board is where a shortfall gets spotted. */}
                              {mgrDrops > 0 && (
                                <div
                                  className="text-[11px] text-gold mt-0.5 tabular-nums"
                                  title="Deliveries this manager covered today — paid per drop on the Tuesday sheet."
                                >
                                  {mgrDrops} deliver{mgrDrops === 1 ? "y" : "ies"}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Daily wage bill — actual clocked so far against the day's
                    expected total, with a bar so the gap reads at a glance. */}
                <div className="mt-3 rounded-lg border border-border bg-surface md:bg-surface-hover px-3 py-2.5">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">
                        Wage so far
                      </div>
                      <div className="text-lg font-semibold tabular-nums text-gold leading-tight">
                        {formatGBP(actualGrandTotal)}
                      </div>
                    </div>
                    <div className="text-right min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">
                        Expected today
                      </div>
                      <div className="text-base font-semibold tabular-nums text-text-primary leading-tight">
                        {formatGBP(expectedGrandTotal)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold transition-all"
                      style={{
                        width: `${
                          expectedGrandTotal > 0
                            ? Math.min(100, (actualGrandTotal / expectedGrandTotal) * 100)
                            : actualGrandTotal > 0
                              ? 100
                              : 0
                        }%`,
                      }}
                    />
                  </div>
                  {isSuperAdmin && (storeManagers.length > 0 || hasCover) && (
                    <div className="mt-1.5 text-[10px] text-text-muted tabular-nums">
                      {formatGBP(actualTotal)} staff + {formatGBP(managerActualTotal)} mgrs
                      {hasCover && <> + {formatGBP(coverActualTotal)} cover</>} of{" "}
                      {formatGBP(expectedGrandTotal)} expected
                    </div>
                  )}
                </div>

                {/* Home staff & managers working at the other store today */}
                {(awayStaff.length > 0 || awayManagers.length > 0) && (
                  <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5 md:p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gold/90 mb-1.5">
                      Working at another store today
                    </div>
                    <div className="flex flex-col gap-1">
                      {awayManagers.map(({ mgr, at }) => (
                        <div
                          key={mgr.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-text-primary truncate">
                            {mgr.name || mgr.username}
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-text-muted">
                              manager
                            </span>
                          </span>
                          <span className="text-gold text-xs shrink-0">
                            @ {at?.name ?? "another store"}
                          </span>
                        </div>
                      ))}
                      {awayStaff.map(({ emp, atLabel }) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-text-primary truncate">{emp.name}</span>
                          <span className="text-gold text-xs shrink-0">@ {atLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="md:hidden flex flex-col gap-2 px-1.5 py-2">
                {sorted.length === 0 && (
                  <p className="px-2 py-6 text-center text-text-muted text-sm">
                    No staff scheduled today. <span className="text-warning">TBC</span>
                  </p>
                )}
                {sorted.length > 0 &&
                  mobileFiltering &&
                  !wageRows.some((r) => showOnMobile(r.emp.name, r.status)) && (
                    <p className="px-2 py-4 text-center text-text-muted text-sm">
                      No employees match.
                    </p>
                  )}
                {wageRows.filter((r) => showOnMobile(r.emp.name, r.status)).map((r) => (
                  <LivePersonCard
                    key={r.emp.id}
                    name={r.emp.name}
                    role={r.emp.position ?? "Team member"}
                    status={r.status}
                    statusLabel={STATUS_STYLES[r.status].label}
                    shiftLabel={bookedShiftLabel(r.storeShifts, r.shift)}
                    shiftNote={r.fromTemplate && r.shift ? "default" : null}
                    clockInAt={r.clock?.clock_in_at ?? null}
                    clockOutAt={r.clock?.clock_out_at ?? null}
                    expectedHours={r.expHours}
                    workedHours={r.actHours}
                    expectedWage={r.expectedWage}
                    actualWage={r.actualWage}
                    deliveries={
                      hasRole(r.emp.position, "Driver") ? (r.deliveries ?? 0) : null
                    }
                    shiftCount={r.sessions.length}
                    shiftsLabel={sessionsLabel(r.sessions)}
                    manualEntry={r.manualEntry}
                    manualReason={r.manualReason}
                  />
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm md:min-w-[720px]">
                  <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="text-left px-3 py-2">Employee</th>
                      <th className="text-left px-2 py-2">Role</th>
                      <th className="text-left px-2 py-2">Shift</th>
                      <th className="text-center px-2 py-2">In</th>
                      <th className="text-center px-2 py-2">Out</th>
                      <th className="text-center px-2 py-2">Status</th>
                      <th className="text-right px-2 py-2">Exp. £</th>
                      <th className="text-right px-2 py-2">Act. £</th>
                      <th className="text-center px-2 py-2">Deliv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-center text-text-muted text-sm"
                        >
                          No staff scheduled today. <span className="text-warning">TBC</span>
                        </td>
                      </tr>
                    )}
                    {wageRows.map(({ emp, shift, storeShifts, fromTemplate, clock, sessions, status, deliveries, manualEntry, manualReason, expectedWage, actualWage }) => {
                      const style = STATUS_STYLES[status];
                      const shiftCount = sessions.length;
                      // "09:00–13:00, 17:00–now" — hover detail so a second
                      // shift is never mistaken for one long unbroken day.
                      const shiftsLabel = sessionsLabel(sessions);
                      return (
                        <tr
                          key={emp.id}
                          data-status={status}
                          className={
                            "border-t border-border " + (ROW_BG[status] ?? "")
                          }
                        >
                          <td className="px-3 py-2 font-medium text-text-primary">
                            {emp.name}
                          </td>
                          <td className="px-2 py-2 text-text-subtle">
                            {emp.position ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-text-subtle">
                            {bookedShiftLabel(storeShifts, shift)}
                            {fromTemplate && shift && (
                              <span
                                className="ml-1 text-[9px] uppercase tracking-wide text-text-muted"
                                title="From the employee's recurring schedule (no rota published)"
                              >
                                default
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            <span title={shiftCount > 1 ? shiftsLabel : undefined}>
                              {formatTimeOnly(clock?.clock_in_at)}
                            </span>
                            {shiftCount > 1 && (
                              <span
                                className="ml-1 text-[9px] font-medium text-gold"
                                title={`${shiftCount} shifts today — ${shiftsLabel}`}
                              >
                                ×{shiftCount}
                              </span>
                            )}
                            {manualEntry && (
                              <span
                                className="block text-[9px] uppercase tracking-wide text-warning"
                                title={
                                  manualReason
                                    ? `Entered by a manager — ${manualReason}`
                                    : "Entered by a manager (no location check)"
                                }
                              >
                                manual
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            <span title={shiftCount > 1 ? shiftsLabel : undefined}>
                              {formatTimeOnly(clock?.clock_out_at)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border " +
                                style.cls
                              }
                            >
                              {style.label}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-xs tabular-nums text-text-subtle">
                            {expectedWage > 0 ? formatGBP(expectedWage) : "—"}
                          </td>
                          <td className="px-2 py-2 text-right text-xs tabular-nums text-text-primary">
                            {actualWage > 0 ? formatGBP(actualWage) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-text-subtle">
                            {hasRole(emp.position, "Driver") && deliveries != null
                              ? deliveries
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cover drivers — rendered only when this store has any today.
                  Most stores use them at weekends only, so an empty block every
                  weekday would be noise. */}
              {hasCover && (
                <div className="border-t-2 border-gold/30">
                  <div className="px-3 py-2 bg-gold/5 text-[10px] uppercase tracking-wider text-gold/90 flex items-center justify-between gap-2">
                    <span>Cover drivers · {storeCoverRows.length}</span>
                    {canAddClockIn && (
                      <button
                        onClick={() => setAdding({ mode: "cover_driver", storeId: store.id })}
                        className="normal-case tracking-normal text-[11px] text-gold hover:underline"
                        title="Record a clock-in for a cover driver who forgot"
                      >
                        + Add clock-in
                      </button>
                    )}
                  </div>
                  <div className="md:hidden flex flex-col gap-2 px-1.5 py-2">
                    {mobileFiltering &&
                      !storeCoverRows.some((r) => showOnMobile(r.driver.name, r.status)) && (
                        <p className="px-2 py-3 text-center text-text-muted text-sm">
                          No cover drivers match.
                        </p>
                      )}
                    {storeCoverRows.filter((r) => showOnMobile(r.driver.name, r.status)).map((r) => (
                      <LivePersonCard
                        key={r.driver.id}
                        name={r.driver.name}
                        role="Cover Driver"
                        status={r.status}
                        statusLabel={STATUS_STYLES[r.status].label}
                        shiftLabel={formatShiftRange(
                          r.shift?.is_day_off ?? false,
                          r.shift?.start_time ?? null,
                          r.shift?.end_time ?? null,
                          r.shift?.is_on_leave,
                        )}
                        shiftNote={r.shift?.fromTemplate ? "usual" : null}
                        clockInAt={r.clock?.clock_in_at ?? null}
                        clockOutAt={r.clock?.clock_out_at ?? null}
                        expectedHours={r.expHours}
                        workedHours={r.actHours}
                        expectedWage={r.expectedWage}
                        actualWage={r.actualWage}
                        deliveries={r.deliveries}
                        manualEntry={r.clock?.manual_entry ?? false}
                        manualReason={r.clock?.manual_entry_reason ?? null}
                      />
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm md:min-w-[720px]">
                      <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
                        <tr>
                          <th className="text-left px-3 py-2">Employee</th>
                          <th className="text-left px-2 py-2">Role</th>
                          <th className="text-left px-2 py-2">Shift</th>
                          <th className="text-center px-2 py-2">In</th>
                          <th className="text-center px-2 py-2">Out</th>
                          <th className="text-center px-2 py-2">Status</th>
                          <th className="text-right px-2 py-2">Exp. £</th>
                          <th className="text-right px-2 py-2">Act. £</th>
                          <th className="text-center px-2 py-2">Deliv.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeCoverRows.map(
                          ({ driver, shift, clock, status, deliveries, expectedWage, actualWage }) => {
                            const style = STATUS_STYLES[status];
                            return (
                              <tr
                                key={driver.id}
                                data-status={status}
                                className={
                                  "border-t border-border " + (ROW_BG[status] ?? "")
                                }
                              >
                                <td className="px-3 py-2 font-medium text-text-primary">
                                  {driver.name}
                                </td>
                                <td className="px-2 py-2 text-text-subtle">Cover Driver</td>
                                <td className="px-2 py-2 text-text-subtle">
                                  {formatShiftRange(
                                    shift?.is_day_off ?? false,
                                    shift?.start_time ?? null,
                                    shift?.end_time ?? null,
                                    shift?.is_on_leave,
                                  )}
                                  {shift?.fromTemplate && (
                                    <span
                                      className="ml-1 text-[9px] uppercase tracking-wide text-text-muted"
                                      title="From the driver's usual weekly availability (no shift set for today)"
                                    >
                                      usual
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center text-xs">
                                  {formatTimeOnly(clock?.clock_in_at)}
                                  {clock?.manual_entry && (
                                    <span
                                      className="block text-[9px] uppercase tracking-wide text-warning"
                                      title={
                                        clock.manual_entry_reason
                                          ? `Entered by a manager — ${clock.manual_entry_reason}`
                                          : "Entered by a manager (no location check)"
                                      }
                                    >
                                      manual
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center text-xs">
                                  {formatTimeOnly(clock?.clock_out_at)}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span
                                    className={
                                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border " +
                                      style.cls
                                    }
                                  >
                                    {style.label}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right text-xs tabular-nums text-text-subtle">
                                  {expectedWage > 0 ? formatGBP(expectedWage) : "—"}
                                </td>
                                <td className="px-2 py-2 text-right text-xs tabular-nums text-text-primary">
                                  {actualWage > 0 ? formatGBP(actualWage) : "—"}
                                </td>
                                <td className="px-2 py-2 text-center text-xs text-text-subtle">
                                  {clock?.short_deliveries_count == null &&
                                  clock?.long_deliveries_count == null
                                    ? "—"
                                    : deliveries}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <ManualClockEntryModal
          mode={adding.mode}
          eventDate={todayIso}
          // The card is one store, so that is where the shift is recorded —
          // never the person's home store, which is what the server would
          // otherwise pick for an admin recording someone covering elsewhere.
          defaultStoreId={adding.storeId}
          stores={stores}
          candidates={
            adding.mode === "manager"
              ? managers
                  .filter((m) => {
                    // Deliberately NOT filtered to the card's store. Managers
                    // cover for each other across stores, so a Hitchin manager
                    // who worked a Stevenage shift has to be pickable from
                    // Stevenage's card or their day cannot be recorded at all.
                    // Where it lands is decided by defaultStoreId below.
                    //
                    // Only someone CURRENTLY on shift is excluded — a manager
                    // who already worked and clocked out can still be given a
                    // forgotten second shift.
                    const mc = managerClockByMgr.get(m.id);
                    return !(mc?.clock_in_at && !mc.clock_out_at);
                  })
                  // Whoever is at THIS store today first, so the common case is
                  // still the top of the list and a visitor is a deliberate pick.
                  .sort((a, b) => {
                    const aHere = managerTodayStoreOf(a) === adding.storeId;
                    const bHere = managerTodayStoreOf(b) === adding.storeId;
                    if (aHere !== bHere) return aHere ? -1 : 1;
                    return (a.name || a.username || "").localeCompare(
                      b.name || b.username || "",
                    );
                  })
                  .map<ManualEntryCandidate>((m) => {
                    const booked = managerShiftByMgr.get(m.id);
                    return {
                      id: m.id,
                      name: m.name || m.username || "Manager",
                      scheduled_start: booked?.is_day_off
                        ? null
                        : booked?.start_time ?? null,
                      scheduled_end: booked?.is_day_off ? null : booked?.end_time ?? null,
                      // Real shifts only — managerSessionsByMgr already drops
                      // the deliveries-only carrier rows.
                      existing_shifts: managerSessionsByMgr.get(m.id)?.length ?? 0,
                      store_id: m.store_id ?? null,
                      existing_store_id: managerClockByMgr.get(m.id)?.store_id ?? null,
                    };
                  })
              : adding.mode === "employee"
              ? employees
                  .filter((e) => {
                    if (e.employment_status !== "active") return false;
                    // Deliberately NOT filtered to the card's store, for the
                    // same reason managers aren't: staff cross-cover, and
                    // someone who covered here without a clock row or a rota
                    // cell here still resolves to their HOME store — so the
                    // card that actually saw them would not hold them at all.
                    // Where the shift lands is decided by defaultStoreId above.
                    //
                    // Only someone CURRENTLY on shift is excluded. Having
                    // already worked and clocked out is no bar — a day can hold
                    // several shifts, and recording a forgotten second one is
                    // exactly what this is for.
                    const c = clockByEmp.get(e.id);
                    return !(c?.clock_in_at && !c.clock_out_at);
                  })
                  // Whoever is at THIS store today first, so the common pick is
                  // still the top of the list and a visitor is a deliberate one.
                  .sort((a, b) => {
                    const aHere = todayStoresOf(a).includes(adding.storeId);
                    const bHere = todayStoresOf(b).includes(adding.storeId);
                    if (aHere !== bHere) return aHere ? -1 : 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map<ManualEntryCandidate>((e) => {
                    // The booking AT the store being recorded against — a shift
                    // at the other store is not what this entry is filling in.
                    const { shift } = effectiveShiftFor(
                      e.id,
                      adding.storeId,
                      e.store_id === adding.storeId,
                    );
                    return {
                      id: e.id,
                      name: e.name,
                      scheduled_start: shift?.is_day_off ? null : shift?.start_time ?? null,
                      scheduled_end: shift?.is_day_off ? null : shift?.end_time ?? null,
                      existing_shifts: sessionsByEmp.get(e.id)?.length ?? 0,
                      store_id: e.store_id ?? null,
                      existing_store_id: clockByEmp.get(e.id)?.store_id ?? null,
                    };
                  })
              : coverDrivers
                  .filter(
                    (d) =>
                      d.is_active &&
                      d.store_id === adding.storeId &&
                      !coverClockByDriver.get(d.id)?.clock_in_at,
                  )
                  .map<ManualEntryCandidate>((d) => {
                    const eff = resolveCoverDriverShift(
                      coverShiftByDriver.get(d.id),
                      coverScheduleByDriverDay.get(`${d.id}:${todayWeekday}`),
                    );
                    return {
                      id: d.id,
                      name: d.name,
                      scheduled_start: eff?.is_day_off ? null : eff?.start_time ?? null,
                      scheduled_end: eff?.is_day_off ? null : eff?.end_time ?? null,
                    };
                  })
          }
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            router.refresh();
          }}
        />
      )}

      <Card className="p-3 md:p-5 text-xs text-text-muted">
        <div className="flex items-center gap-x-3 gap-y-1.5 md:gap-4 flex-wrap">
          <span className="text-text-subtle font-medium">Status key:</span>
          {(["on_shift", "expected", "late", "clocked_out", "day_off", "on_leave", "absent", "tbc"] as LiveDashboardStatus[]).map(
            (s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className={
                    "inline-block h-3 w-3 rounded-sm border " + STATUS_STYLES[s].cls
                  }
                />
                {STATUS_STYLES[s].label}
              </span>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}
