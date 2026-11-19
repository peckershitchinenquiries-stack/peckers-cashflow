"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ShiftEditModal } from "./ShiftEditModal";
import { DeliveryEditModal } from "./DeliveryEditModal";
import { ManagerShiftEditModal } from "./ManagerShiftEditModal";
import { CoverDriverShiftEditModal } from "./CoverDriverShiftEditModal";
import { resolveCoverDriverShift, weekdayOf } from "@/lib/cover-driver-hours";
import {
  WEEKDAY_SHORT,
  addDays,
  eachDay,
  formatGBP,
  formatHoursMinsWords,
  formatShiftRange,
  parseISODate,
  startOfISOWeek,
  toISODate,
  todayISO,
  weekdayIndex,
} from "@/lib/utils";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { HoursMinsDisplay } from "@/components/ui/HoursMinsDisplay";
import { applyScheduleToWeek } from "@/app/actions/schedule";
import { worksForCash } from "@/lib/cash-flow";
import { wageComplianceForEmployee } from "@/lib/compliance";
import { DEFAULT_SETTINGS, type MinWageBands, type ShiftTimeSettings } from "@/lib/settings";
import type {
  AllowedUser,
  ClockEvent,
  EmployeeScheduleDay,
  RotaEmployee,
  CoverDriver,
  CoverDriverClockEvent,
  CoverDriverScheduleDay,
  CoverDriverShift,
  ManagerClockEvent,
  ManagerShift,
  RotaHistoryShift,
  RotaShift,
  ShiftPreset,
  Store,
  WeeklyDelivery,
} from "@/lib/types";
import { hasRole } from "@/lib/types";

type RotaGroupFilter = "all" | "managers" | "staff" | "cover";

/** Short label for a rota preset, shown under the time in a filled cell. */
function presetShort(t: ShiftPreset | null): string | null {
  if (t === "open_close") return "Open–Close";
  if (t === "evening_close") return "Eve–Close";
  return null;
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Leave is amber so a booked holiday never reads as a plain red Day Off. */
function dayOffTone(onLeave: boolean | undefined, past: boolean): string {
  if (onLeave) {
    return past
      ? "bg-warning/5 border-warning/20 text-warning"
      : "bg-warning/10 border-warning/30 text-warning";
  }
  return past
    ? "bg-danger/5 border-danger/20 text-danger"
    : "bg-danger/10 border-danger/30 text-danger";
}

/** One clocked shift, as the Rota needs it: store, day and worked window. */
export type RotaClockSession = {
  employee_id: string;
  store_id: string | null;
  event_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  short_deliveries_count: number | null;
  long_deliveries_count: number | null;
  extra_short_deliveries: number | null;
  extra_long_deliveries: number | null;
};

/** One manager shift, as the Rota needs it. */
export type RotaManagerSession = {
  manager_id: string;
  store_id: string | null;
  event_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  auto_clocked_out: boolean | null;
  deliveries_only: boolean | null;
  short_deliveries_count: number | null;
  long_deliveries_count: number | null;
  extra_short_deliveries: number | null;
  extra_long_deliveries: number | null;
};

type Props = {
  stores: Store[];
  employees: RotaEmployee[];
  /** Bookings inside the visible range only. */
  shifts: RotaShift[];
  /** The 4 weeks before the range, for the rolling average — never rendered. */
  historyShifts?: RotaHistoryShift[];
  clocks: ClockEvent[];
  /** The SHIFTS under those days (migration 029). A day header can only name one
   *  store, so every per-store figure on the employee rows resolves from these. */
  clockSessions?: RotaClockSession[];
  weeklyDeliveries: WeeklyDelivery[];
  schedules?: EmployeeScheduleDay[];
  /** Manager rota group shown above the staff rows (admin and manager Rota). */
  managers?: AllowedUser[];
  managerShifts?: ManagerShift[];
  managerClocks?: ManagerClockEvent[];
  /** The shifts under those days. A manager's header names one store, but where
   *  they clocked in — at either store — is what places them on a store's rota. */
  managerSessions?: RotaManagerSession[];
  /** Cover driver rota, shown below the employee rota. Hidden entirely when the
   *  store has no cover drivers; cells stay blank on days they aren't booked,
   *  which is most weekdays. */
  coverDrivers?: CoverDriver[];
  coverDriverShifts?: CoverDriverShift[];
  coverDriverSchedules?: CoverDriverScheduleDay[];
  coverDriverClocks?: CoverDriverClockEvent[];
  minWageBands?: MinWageBands;
  shiftTimes?: ShiftTimeSettings;
  rangeStartIso: string;
  rangeEndIso: string;
  userRole: string;
  userStoreId: string | null;
};

export function RotaView({
  stores,
  employees,
  shifts,
  historyShifts = [],
  clocks,
  clockSessions = [],
  weeklyDeliveries,
  schedules = [],
  managers = [],
  managerShifts = [],
  managerClocks = [],
  managerSessions = [],
  coverDrivers = [],
  coverDriverShifts = [],
  coverDriverSchedules = [],
  coverDriverClocks = [],
  minWageBands = DEFAULT_SETTINGS.min_wage_bands,
  shiftTimes = DEFAULT_SETTINGS.shift_times,
  rangeStartIso,
  rangeEndIso,
  userRole,
  userStoreId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const rangeStart = React.useMemo(() => parseISODate(rangeStartIso), [rangeStartIso]);
  const rangeEnd = React.useMemo(() => parseISODate(rangeEndIso), [rangeEndIso]);
  // ISO week anchoring the range start — used for weekly deliveries & "apply
  // defaults", both of which remain week-based concepts.
  const weekStart = React.useMemo(() => startOfISOWeek(rangeStart), [rangeStart]);
  const [applying, setApplying] = React.useState(false);
  const [activeStoreId, setActiveStoreId] = React.useState<string>(
    userStoreId && stores.some((s) => s.id === userStoreId)
      ? userStoreId
      : stores[0]?.id ?? "",
  );
  // Employees the user has pulled onto this store's rota from another store
  // (before their first shift is saved). Cleared when the active store changes.
  const [addedVisitorIds, setAddedVisitorIds] = React.useState<string[]>([]);
  React.useEffect(() => setAddedVisitorIds([]), [activeStoreId]);
  // Same idea for managers: other-store managers pulled onto this store's
  // manager rota before their first cover shift is saved.
  const [addedManagerVisitorIds, setAddedManagerVisitorIds] = React.useState<string[]>([]);
  React.useEffect(() => setAddedManagerVisitorIds([]), [activeStoreId]);
  // Reset on store change: the other store may have no cover drivers to filter to.
  const [groupFilter, setGroupFilter] = React.useState<RotaGroupFilter>("all");
  React.useEffect(() => setGroupFilter("all"), [activeStoreId]);
  const [editingShift, setEditingShift] = React.useState<{
    employee: RotaEmployee;
    date: string;
    existing: RotaShift | null;
    prefill: { start: string; end: string } | null;
    /** Every shift already booked for this employee+date at this store — lets
     *  the modal show them and offer "add another" alongside editing `existing`. */
    dayShifts: RotaShift[];
    /** Set when the day already holds a shift at the OTHER store, so the modal
     *  can say what it is — the times here must not coincide with it. */
    awayNote?: string;
  } | null>(null);
  const [editingDelivery, setEditingDelivery] = React.useState<{
    driver: RotaEmployee;
    existing: WeeklyDelivery | null;
    weekDays: string[];
    events: ClockEvent[];
  } | null>(null);
  const [editingCoverShift, setEditingCoverShift] = React.useState<{
    driver: CoverDriver;
    date: string;
    existing: CoverDriverShift | null;
    prefill: { start: string; end: string } | null;
  } | null>(null);
  const [editingManagerShift, setEditingManagerShift] = React.useState<{
    manager: AllowedUser;
    date: string;
    existing: ManagerShift | null;
    prefill: { start: string; end: string } | null;
  } | null>(null);

  // Phones show one day at a time; default to today when it's in range.
  const [mobileDayIso, setMobileDayIso] = React.useState(() => {
    const t = todayISO();
    return t >= rangeStartIso && t <= rangeEndIso ? t : rangeStartIso;
  });
  React.useEffect(() => {
    const t = todayISO();
    setMobileDayIso(t >= rangeStartIso && t <= rangeEndIso ? t : rangeStartIso);
  }, [rangeStartIso, rangeEndIso]);
  const mobileDay = React.useMemo(() => parseISODate(mobileDayIso), [mobileDayIso]);
  const dayStripRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    dayStripRef.current
      ?.querySelector<HTMLElement>("[data-selected='true']")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [mobileDayIso]);

  const isSuperAdmin = userRole === "admin";
  const activeStore = stores.find((s) => s.id === activeStoreId);
  // Every day in the selected range (kept as `weekDays` for the rest of the
  // component, but it can now span any number of days).
  const weekDays = React.useMemo(
    () => eachDay(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );
  const rangeDayCount = weekDays.length;

  const storeById = React.useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const visibleDates = React.useMemo(
    () => new Set(weekDays.map((d) => toISODate(d))),
    [weekDays],
  );

  // Employees who have a shift AT the active store within the visible range —
  // i.e. staff visiting from the other store to cover here.
  const visitorIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      if (s.store_id === activeStoreId && visibleDates.has(s.shift_date)) {
        set.add(s.employee_id);
      }
    }
    return set;
  }, [shifts, activeStoreId, visibleDates]);

  // Rows shown on this store's rota: the store's own active staff, anyone with a
  // shift here in range (a visitor), and anyone just picked from another store.
  // Home staff sort first, then visitors, each alphabetical.
  const rotaEmployees = React.useMemo(() => {
    return employees
      .filter(
        (e) =>
          e.employment_status === "active" &&
          (e.store_id === activeStoreId ||
            visitorIds.has(e.id) ||
            addedVisitorIds.includes(e.id)),
      )
      .sort((a, b) => {
        const av = a.store_id === activeStoreId ? 0 : 1;
        const bv = b.store_id === activeStoreId ? 0 : 1;
        return av - bv || a.name.localeCompare(b.name);
      });
  }, [employees, activeStoreId, visitorIds, addedVisitorIds]);

  // Other-store staff not already on the grid — the pool for "add visiting staff".
  const eligibleVisitors = React.useMemo(
    () =>
      employees
        .filter(
          (e) =>
            e.employment_status === "active" &&
            e.store_id !== activeStoreId &&
            !visitorIds.has(e.id) &&
            !addedVisitorIds.includes(e.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, activeStoreId, visitorIds, addedVisitorIds],
  );

  // Index shifts: key = `${employee_id}:${shift_date}`. A day can hold several
  // shifts now (split days), so every date buckets to a LIST, not one cell.
  const shiftByKey = React.useMemo(() => {
    const m = new Map<string, RotaShift[]>();
    for (const s of shifts) {
      const key = `${s.employee_id}:${s.shift_date}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    }
    return m;
  }, [shifts]);

  // Clocks indexed by employee+date
  const clockByKey = React.useMemo(() => {
    const m = new Map<string, ClockEvent>();
    for (const c of clocks) m.set(`${c.employee_id}:${c.event_date}`, c);
    return m;
  }, [clocks]);

  // A manager's real shifts per day, earliest first. Deliveries-only rows carry
  // drops for a day nobody clocked, so they never place anyone anywhere.
  const managerSessionsByKey = React.useMemo(() => {
    const m = new Map<string, RotaManagerSession[]>();
    for (const s of managerSessions) {
      if (s.deliveries_only) continue;
      const key = `${s.manager_id}:${s.event_date}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at));
    return m;
  }, [managerSessions]);

  const managerClockByKey = React.useMemo(() => {
    const m = new Map<string, ManagerClockEvent>();
    for (const c of managerClocks) m.set(`${c.manager_id}:${c.event_date}`, c);
    return m;
  }, [managerClocks]);

  // Where a manager actually clocked in on a day — every store, since a day can
  // be split. Wins over the booking and the home store: Shreehari, homed at
  // Hitchin and never booked, was listed at Hitchin while clocked in at
  // Stevenage (Update 282). A pre-031 day with no shifts falls back to its header.
  function managerClockedStores(managerId: string, dateIso: string): string[] {
    const key = `${managerId}:${dateIso}`;
    const sessions = managerSessionsByKey.get(key);
    if (sessions?.length) {
      return Array.from(
        new Set(sessions.map((s) => s.store_id).filter((v): v is string => Boolean(v))),
      );
    }
    const clk = managerClockByKey.get(key);
    return clk?.clock_in_at && clk.store_id ? [clk.store_id] : [];
  }

  // Managers booked OR clocked in at the active store within the visible range
  // — i.e. a manager visiting from the other store to cover here.
  const managerVisitorIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of managerShifts) {
      if (s.store_id === activeStoreId && visibleDates.has(s.shift_date)) {
        set.add(s.manager_id);
      }
    }
    for (const [key, sessions] of managerSessionsByKey) {
      const [managerId, dateIso] = key.split(":");
      if (visibleDates.has(dateIso) && sessions.some((s) => s.store_id === activeStoreId)) {
        set.add(managerId);
      }
    }
    for (const c of managerClocks) {
      if (
        c.clock_in_at &&
        c.store_id === activeStoreId &&
        visibleDates.has(c.event_date) &&
        !managerSessionsByKey.has(`${c.manager_id}:${c.event_date}`)
      ) {
        set.add(c.manager_id);
      }
    }
    return set;
  }, [managerShifts, managerSessionsByKey, managerClocks, activeStoreId, visibleDates]);

  // Managers shown above the employee rota: this store's own managers, anyone
  // covering here in range (a visitor), and anyone just picked from another
  // store. Home managers sort first, then visitors, each alphabetical.
  const activeManagers = React.useMemo(
    () =>
      managers
        .filter(
          (m) =>
            m.store_id === activeStoreId ||
            managerVisitorIds.has(m.id) ||
            addedManagerVisitorIds.includes(m.id),
        )
        .sort((a, b) => {
          const av = a.store_id === activeStoreId ? 0 : 1;
          const bv = b.store_id === activeStoreId ? 0 : 1;
          return (
            av - bv ||
            (a.name || a.username || "").localeCompare(b.name || b.username || "")
          );
        }),
    [managers, activeStoreId, managerVisitorIds, addedManagerVisitorIds],
  );

  // Other-store managers not already on the grid — the pool for "add a
  // visiting manager".
  const eligibleManagerVisitors = React.useMemo(
    () =>
      managers
        .filter(
          (m) =>
            m.store_id !== activeStoreId &&
            !managerVisitorIds.has(m.id) &&
            !addedManagerVisitorIds.includes(m.id),
        )
        .sort((a, b) =>
          (a.name || a.username || "").localeCompare(b.name || b.username || ""),
        ),
    [managers, activeStoreId, managerVisitorIds, addedManagerVisitorIds],
  );

  const managerVisitingCount = activeManagers.filter(
    (m) => m.store_id !== activeStoreId,
  ).length;

  // Manager shifts indexed by manager+date
  const managerShiftByKey = React.useMemo(() => {
    const m = new Map<string, ManagerShift>();
    for (const s of managerShifts) m.set(`${s.manager_id}:${s.shift_date}`, s);
    return m;
  }, [managerShifts]);

  // ---- Cover drivers ----
  // Unlike staff and managers, cover drivers belong to one store and aren't
  // loaned out, so there's no "visiting" case to resolve here.
  const activeCoverDrivers = React.useMemo(
    () =>
      coverDrivers
        .filter((d) => d.is_active && d.store_id === activeStoreId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [coverDrivers, activeStoreId],
  );

  const coverShiftByKey = React.useMemo(() => {
    const m = new Map<string, CoverDriverShift>();
    for (const s of coverDriverShifts) m.set(`${s.cover_driver_id}:${s.shift_date}`, s);
    return m;
  }, [coverDriverShifts]);

  const coverScheduleByKey = React.useMemo(() => {
    const m = new Map<string, CoverDriverScheduleDay>();
    for (const s of coverDriverSchedules) m.set(`${s.cover_driver_id}:${s.weekday}`, s);
    return m;
  }, [coverDriverSchedules]);

  const coverClockByKey = React.useMemo(() => {
    const m = new Map<string, CoverDriverClockEvent>();
    for (const c of coverDriverClocks) m.set(`${c.cover_driver_id}:${c.event_date}`, c);
    return m;
  }, [coverDriverClocks]);

  // Booked hours across the visible range. Counts only saved rota cells — the
  // weekly availability pattern is a hint, not a booking, so it must not inflate
  // the total or the expected wage.
  function rangeCoverTotalHours(driverId: string): number {
    return weekDays.reduce((sum, d) => {
      const cell = coverShiftByKey.get(`${driverId}:${toISODate(d)}`);
      if (!cell || cell.is_day_off) return sum;
      return sum + (Number(cell.scheduled_hours) || 0);
    }, 0);
  }

  // Deliveries logged at clock-out, summed per cover driver for the shown range.
  // Read-only: cover drivers have no 4-week average or Vita Mojo cross-check —
  // weekly_deliveries is keyed to `employees`, and they are ad-hoc anyway, so
  // there is no baseline to average against.
  const coverDeliveriesByDriver = React.useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => toISODate(d)));
    const live = new Map<string, number>();
    const extra = new Map<string, number>();
    for (const c of coverDriverClocks) {
      if (!weekSet.has(c.event_date)) continue;
      if (c.short_deliveries_count != null || c.long_deliveries_count != null) {
        const total =
          (Number(c.short_deliveries_count) || 0) + (Number(c.long_deliveries_count) || 0);
        live.set(c.cover_driver_id, (live.get(c.cover_driver_id) ?? 0) + total);
      }
      const ex =
        (Number(c.extra_short_deliveries) || 0) + (Number(c.extra_long_deliveries) || 0);
      if (ex) extra.set(c.cover_driver_id, (extra.get(c.cover_driver_id) ?? 0) + ex);
    }
    return { live, extra };
  }, [coverDriverClocks, weekDays]);

  // Drops a manager covered in the shown range, at THIS store. Managers aren't
  // hourly, so the manager rota has no wage column — but these are paid per
  // drop, so the count belongs on the row that shows what they worked.
  // Read from the shifts: the header holds the whole day's drops against one
  // store, so a split day showed every drop on both stores' rows.
  const managerDeliveriesByMgr = React.useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => toISODate(d)));
    const live = new Map<string, number>();
    const extra = new Map<string, number>();
    const add = (
      managerId: string,
      r: {
        short_deliveries_count?: number | null;
        long_deliveries_count?: number | null;
        extra_short_deliveries?: number | null;
        extra_long_deliveries?: number | null;
      },
    ) => {
      const base =
        (Number(r.short_deliveries_count) || 0) + (Number(r.long_deliveries_count) || 0);
      if (base) live.set(managerId, (live.get(managerId) ?? 0) + base);
      const ex =
        (Number(r.extra_short_deliveries) || 0) + (Number(r.extra_long_deliveries) || 0);
      if (ex) extra.set(managerId, (extra.get(managerId) ?? 0) + ex);
    };
    const daysWithShifts = new Set<string>();
    for (const s of managerSessions) {
      daysWithShifts.add(`${s.manager_id}:${s.event_date}`);
      if (weekSet.has(s.event_date) && s.store_id === activeStoreId) add(s.manager_id, s);
    }
    for (const c of managerClocks) {
      if (!weekSet.has(c.event_date)) continue;
      if (daysWithShifts.has(`${c.manager_id}:${c.event_date}`)) continue;
      if (c.store_id && c.store_id !== activeStoreId) continue;
      add(c.manager_id, c);
    }
    return { live, extra };
  }, [managerSessions, managerClocks, weekDays, activeStoreId]);

  // Hours scheduled AT THE ACTIVE STORE only — a manager can be covering another
  // store on a given day, and those hours belong to that store's rota.
  function weekManagerTotalHours(managerId: string): number {
    return weekDays.reduce((sum, d) => {
      const s = managerShiftByKey.get(`${managerId}:${toISODate(d)}`);
      if (!s || s.is_day_off || s.store_id !== activeStoreId) return sum;
      return sum + Number(s.scheduled_hours ?? 0);
    }, 0);
  }

  // Deliveries indexed by driver
  const deliveryByDriver = React.useMemo(() => {
    const m = new Map<string, WeeklyDelivery>();
    for (const d of weeklyDeliveries) m.set(d.driver_id, d);
    return m;
  }, [weeklyDeliveries]);

  // Recurring schedule template indexed by employee + weekday (0=Mon..6=Sun).
  const scheduleByEmpDay = React.useMemo(() => {
    const m = new Map<string, EmployeeScheduleDay>();
    for (const s of schedules) m.set(`${s.employee_id}:${s.weekday}`, s);
    return m;
  }, [schedules]);

  // This store's shifts, indexed by employee+date. A day header names only ONE
  // store — the last one clocked into — so every per-store employee figure below
  // resolves from the shifts instead (Update 225). Drops and the shift badge were
  // reading the day total, which showed all 7 of a split day's drops on BOTH
  // stores' rotas.
  const storeSessionsByEmpDay = React.useMemo(() => {
    const m = new Map<string, RotaClockSession[]>();
    for (const x of clockSessions) {
      if ((x.store_id ?? null) !== activeStoreId) continue;
      const k = `${x.employee_id}:${x.event_date}`;
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return m;
  }, [clockSessions, activeStoreId]);

  // Whether a day has ANY shift rows. A pre-029 day has none, and its header is
  // the only record of the single shift it held — so those keep reading the
  // header rather than reporting zero.
  const daysWithSessions = React.useMemo(
    () => new Set(clockSessions.map((x) => `${x.employee_id}:${x.event_date}`)),
    [clockSessions],
  );

  /** What the employee worked at the ACTIVE store on one day. */
  function storeDayAttendance(employeeId: string, dateIso: string, clk?: ClockEvent | null) {
    const key = `${employeeId}:${dateIso}`;
    if (!daysWithSessions.has(key)) {
      return {
        sessionCount: Number(clk?.session_count ?? 0),
        workedHours: clk?.worked_hours != null ? Number(clk.worked_hours) : null,
        firstInAt: clk?.store_id === activeStoreId ? clk.clock_in_at : null,
      };
    }
    const mine = storeSessionsByEmpDay.get(key) ?? [];
    const closed = mine.filter((x) => x.clock_out_at);
    const hours = closed.reduce((sum, x) => {
      const ms = new Date(x.clock_out_at!).getTime() - new Date(x.clock_in_at).getTime();
      return sum + (ms > 0 ? ms / 3_600_000 : 0);
    }, 0);
    // The header's clock_in_at is the earliest at ANY store, so a split day's
    // Stevenage morning would read as this store's clock-in.
    const firstInAt = mine.reduce<string | null>(
      (min, x) => (!min || x.clock_in_at < min ? x.clock_in_at : min),
      null,
    );
    return {
      sessionCount: mine.length,
      workedHours: closed.length > 0 ? hours : null,
      firstInAt,
    };
  }

  // Live deliveries logged at clock-out, summed per driver for the shown week —
  // AT THIS STORE only. A day worked across two stores splits its drops between
  // them; a pre-029 day with no shift rows still counts off its header.
  const liveDeliveriesByEmp = React.useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => toISODate(d)));
    const m = new Map<string, number>();
    for (const x of clockSessions) {
      if ((x.store_id ?? null) !== activeStoreId) continue;
      if (!weekSet.has(x.event_date)) continue;
      if (x.short_deliveries_count == null && x.long_deliveries_count == null) continue;
      const total =
        (Number(x.short_deliveries_count) || 0) + (Number(x.long_deliveries_count) || 0);
      m.set(x.employee_id, (m.get(x.employee_id) ?? 0) + total);
    }
    for (const c of clocks) {
      if (daysWithSessions.has(`${c.employee_id}:${c.event_date}`)) continue;
      if (c.store_id !== activeStoreId) continue;
      if (c.short_deliveries_count == null && c.long_deliveries_count == null) continue;
      if (!weekSet.has(c.event_date)) continue;
      const total = (Number(c.short_deliveries_count) || 0) + (Number(c.long_deliveries_count) || 0);
      m.set(c.employee_id, (m.get(c.employee_id) ?? 0) + total);
    }
    return m;
  }, [clocks, clockSessions, daysWithSessions, weekDays, activeStoreId]);

  // Extra deliveries (beyond the normal round) summed per driver for the week.
  const liveExtraByEmp = React.useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => toISODate(d)));
    const m = new Map<string, number>();
    for (const x of clockSessions) {
      if ((x.store_id ?? null) !== activeStoreId) continue;
      if (!weekSet.has(x.event_date)) continue;
      const extra =
        (Number(x.extra_short_deliveries) || 0) + (Number(x.extra_long_deliveries) || 0);
      if (extra) m.set(x.employee_id, (m.get(x.employee_id) ?? 0) + extra);
    }
    for (const c of clocks) {
      if (daysWithSessions.has(`${c.employee_id}:${c.event_date}`)) continue;
      if (c.store_id !== activeStoreId) continue;
      const extra = (Number(c.extra_short_deliveries) || 0) + (Number(c.extra_long_deliveries) || 0);
      if (!extra) continue;
      if (!weekSet.has(c.event_date)) continue;
      m.set(c.employee_id, (m.get(c.employee_id) ?? 0) + extra);
    }
    return m;
  }, [clocks, clockSessions, daysWithSessions, weekDays, activeStoreId]);

  // 4-week rolling avg per employee (across all stores) using prior weeks.
  // History rows arrive separately from the visible range's bookings but feed
  // the same week buckets, oldest first so `slice(-4)` takes the latest four.
  const fourWkAvg = React.useMemo(() => {
    const result = new Map<string, number>();
    const allShifts: RotaHistoryShift[] = [...historyShifts, ...shifts];
    for (const emp of employees) {
      const empShifts = allShifts.filter(
        (s) => s.employee_id === emp.id && !s.is_day_off,
      );
      const byWeek = new Map<string, number>();
      for (const s of empShifts) {
        const wk = toISODate(startOfISOWeek(new Date(s.shift_date)));
        byWeek.set(wk, (byWeek.get(wk) ?? 0) + Number(s.scheduled_hours ?? 0));
      }
      const current = toISODate(weekStart);
      const prior = Array.from(byWeek.entries())
        .filter(([wk]) => wk !== current)
        .slice(-4)
        .map(([, h]) => h);
      const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
      result.set(emp.id, avg);
    }
    return result;
  }, [shifts, historyShifts, employees, weekStart]);

  // Navigate by pushing the range to the URL; the server page re-fetches the
  // shifts/clocks for whatever range is requested.
  function setRange(startIso: string, endIso: string) {
    router.push(`${pathname}?start=${startIso}&end=${endIso}`);
  }

  // Step the whole window forward/backward by its own length, so paging keeps
  // showing the same number of days.
  function shiftRange(direction: number) {
    const step = direction * rangeDayCount;
    setRange(
      toISODate(addDays(rangeStart, step)),
      toISODate(addDays(rangeEnd, step)),
    );
  }

  function goToday() {
    const ws = startOfISOWeek(new Date());
    setRange(toISODate(ws), toISODate(addDays(ws, 6)));
  }

  // Generate this week's shifts from each employee's recurring schedule.
  // Only fills empty cells (existing shifts are kept).
  async function applyDefaults() {
    setApplying(true);
    try {
      const res = await applyScheduleToWeek({
        store_id: activeStoreId,
        week_start: toISODate(weekStart),
        overwrite: false,
      });
      const parts: string[] = [];
      if (res.created) parts.push(`${res.created} added`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.skipped) parts.push(`${res.skipped} kept`);
      toast.success(
        parts.length
          ? `Schedule applied — ${parts.join(", ")}`
          : "No schedule templates set for this store yet",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setApplying(false);
    }
  }

  // Hours scheduled AT THE ACTIVE STORE only (a shift can now sit at another
  // store on any given day — those belong to that store's rota, not this one).
  // A day can hold several shifts, so every one of them counts, not just the
  // first.
  function weekTotalHours(empId: string): number {
    return weekDays.reduce((sum, d) => {
      const dayShifts = shiftByKey.get(`${empId}:${toISODate(d)}`) ?? [];
      return (
        sum +
        dayShifts.reduce((s, sh) => {
          if (sh.is_day_off || sh.store_id !== activeStoreId) return s;
          return s + Number(sh.scheduled_hours ?? 0);
        }, 0)
      );
    }, 0);
  }

  // Active-store hours grouped by ISO week. The NI/cash split is a weekly rule,
  // so for multi-week ranges we apply the threshold per week.
  function hoursByWeek(empId: string): number[] {
    const byWeek = new Map<string, number>();
    for (const d of weekDays) {
      const dayShifts = shiftByKey.get(`${empId}:${toISODate(d)}`) ?? [];
      const wk = toISODate(startOfISOWeek(d));
      for (const s of dayShifts) {
        if (s.is_day_off || s.store_id !== activeStoreId) continue;
        byWeek.set(wk, (byWeek.get(wk) ?? 0) + Number(s.scheduled_hours ?? 0));
      }
    }
    return Array.from(byWeek.values());
  }

  // Cash hours for THIS store. NI/bank is a home-store concept: at the
  // employee's home store only hours above the weekly limit are cash; at a store
  // they're visiting, every hour is cash (no NI record there). No cash rate ⇒ no
  // cash hours.
  function weekCashHours(emp: RotaEmployee): number {
    if (!worksForCash(emp)) return 0;
    const isHome = emp.store_id === activeStoreId;
    const limit = Number(emp.bank_weekly_hours_limit ?? 20) || 20;
    return hoursByWeek(emp.id).reduce(
      (sum, h) => sum + (isHome ? Math.max(h - limit, 0) : h),
      0,
    );
  }

  function weekWages(emp: RotaEmployee): { ni: number; cash: number; total: number } {
    const niRate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);
    const cashRate = Number(emp.hourly_cash_rate ?? 0);
    const cashEligible = worksForCash(emp);
    const isHome = emp.store_id === activeStoreId;
    const limit = Number(emp.bank_weekly_hours_limit ?? 20) || 20;
    let niHours = 0;
    let cashHours = 0;
    for (const h of hoursByWeek(emp.id)) {
      if (!cashEligible) {
        // No cash rate: all hours are NI (only meaningful at the home store).
        niHours += h;
      } else if (isHome) {
        niHours += Math.min(h, limit);
        cashHours += Math.max(h - limit, 0);
      } else {
        // Visiting another store — no NI record there, so all hours are cash.
        cashHours += h;
      }
    }
    const ni = niHours * niRate;
    const cash = cashHours * cashRate;
    return { ni, cash, total: ni + cash };
  }

  const expectedWageBill = rotaEmployees.reduce(
    (sum, e) => sum + weekWages(e).total,
    0,
  );
  const visitingCount = rotaEmployees.filter((e) => e.store_id !== activeStoreId).length;

  // ---- One combined rota: managers, staff and cover drivers as groups ----
  // The manager group exists only where the page passes managers.
  const hasManagerGroup = managers.length > 0;
  const hasCoverGroup = activeCoverDrivers.length > 0;
  const groupCount = 1 + (hasManagerGroup ? 1 : 0) + (hasCoverGroup ? 1 : 0);
  const showManagers = hasManagerGroup && (groupFilter === "all" || groupFilter === "managers");
  const showStaff = groupFilter === "all" || groupFilter === "staff";
  const showCover = hasCoverGroup && (groupFilter === "all" || groupFilter === "cover");

  function coverWages(driver: CoverDriver): number {
    return rangeCoverTotalHours(driver.id) * (Number(driver.hourly_cash_rate) || 0);
  }
  const expectedCoverBill = activeCoverDrivers.reduce((sum, d) => sum + coverWages(d), 0);
  const peopleCount =
    (hasManagerGroup ? activeManagers.length : 0) + rotaEmployees.length + activeCoverDrivers.length;
  const totalVisiting = (hasManagerGroup ? managerVisitingCount : 0) + visitingCount;

  // Managers are on a fixed daily wage: their hours count, their pay never does.
  const shownHours =
    (showManagers ? activeManagers.reduce((s, m) => s + weekManagerTotalHours(m.id), 0) : 0) +
    (showStaff ? rotaEmployees.reduce((s, e) => s + weekTotalHours(e.id), 0) : 0) +
    (showCover ? activeCoverDrivers.reduce((s, d) => s + rangeCoverTotalHours(d.id), 0) : 0);
  const shownCashHours =
    (showStaff ? rotaEmployees.reduce((s, e) => s + weekCashHours(e), 0) : 0) +
    (showCover ? activeCoverDrivers.reduce((s, d) => s + rangeCoverTotalHours(d.id), 0) : 0);
  const shownWages = (showStaff ? expectedWageBill : 0) + (showCover ? expectedCoverBill : 0);

  // People booked to work AT THIS STORE on a day, across the groups on screen.
  function bookedHereCount(d: Date): number {
    const iso = toISODate(d);
    let n = 0;
    if (showManagers) {
      for (const m of activeManagers) {
        const s = managerShiftByKey.get(`${m.id}:${iso}`);
        if (s && !s.is_day_off && s.store_id === activeStoreId) n++;
      }
    }
    if (showStaff) {
      for (const e of rotaEmployees) {
        const day = shiftByKey.get(`${e.id}:${iso}`) ?? [];
        if (day.some((s) => !s.is_day_off && s.store_id === activeStoreId)) n++;
      }
    }
    if (showCover) {
      for (const c of activeCoverDrivers) {
        const s = coverShiftByKey.get(`${c.id}:${iso}`);
        if (s && !s.is_day_off) n++;
      }
    }
    return n;
  }

  const groupChips: { key: RotaGroupFilter; label: string; count: number }[] = [
    { key: "all", label: "Everyone", count: peopleCount },
    ...(hasManagerGroup
      ? [{ key: "managers" as const, label: "Managers", count: activeManagers.length }]
      : []),
    { key: "staff", label: "Staff", count: rotaEmployees.length },
    ...(hasCoverGroup
      ? [{ key: "cover" as const, label: "Cover drivers", count: activeCoverDrivers.length }]
      : []),
  ];
  const groupSummary = [
    hasManagerGroup
      ? `${activeManagers.length} manager${activeManagers.length === 1 ? "" : "s"}`
      : null,
    `${rotaEmployees.length} staff`,
    hasCoverGroup
      ? `${activeCoverDrivers.length} cover driver${activeCoverDrivers.length === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  const colCount = 4 + weekDays.length + 5;

  function groupHeadingRow(label: string, note: string): React.ReactNode {
    if (groupCount < 2) return null;
    return (
      <tr className="border-t border-border bg-surface-hover/40">
        <td colSpan={colCount} className="px-3 py-1.5 text-[11px] text-text-muted">
          <span className="sticky left-3 inline-block">
            <span className="uppercase tracking-wider font-medium text-text-subtle">{label}</span>
            <span> · {note}</span>
          </span>
        </td>
      </tr>
    );
  }

  function groupHeadingItem(label: string, note: string): React.ReactNode {
    if (groupCount < 2) return null;
    return (
      <li className="px-4 py-1.5 bg-surface-hover/40 text-[11px] text-text-muted">
        <span className="uppercase tracking-wider font-medium text-text-subtle">{label}</span>
        <span> · {note}</span>
      </li>
    );
  }

  const MANAGER_NOTE = "fixed daily wage, not in the wage bill";
  const STAFF_NOTE = "NI up to their weekly limit, cash above it";
  const COVER_NOTE = "cash per hour, paid from what they clock";

  // One manager's cell for one day — shared by the desktop grid and the phone day list.
  function managerDayCell(mgr: AllowedUser, d: Date): React.ReactNode {
    const dateIso = toISODate(d);
    const key = `${mgr.id}:${dateIso}`;
    const cell = managerShiftByKey.get(key);
    const clockedStores = managerClockedStores(mgr.id, dateIso);
    const clockedHere = clockedStores.includes(activeStoreId);
    const clockedAway = clockedStores.filter((id) => id !== activeStoreId);
    const bookedHere = !!cell && cell.store_id === activeStoreId;
    const shortName = (id: string) => storeById.get(id)?.name?.split(" ")[0] ?? "Away";
    // At ANOTHER store this day — read-only here, so this store's view shows
    // where the manager has gone. Where they clocked in beats where they were
    // booked; a booking HERE keeps its cell so it can still be edited.
    if (!clockedHere && !bookedHere && (cell || clockedAway.length > 0)) {
      const awaySessions = (managerSessionsByKey.get(key) ?? []).filter(
        (s) => s.store_id && s.store_id !== activeStoreId,
      );
      const awayIds = clockedAway.length > 0 ? clockedAway : [cell!.store_id];
      const awayNames = awayIds.map((id) => storeById.get(id)?.name ?? "another store");
      const lastOut = awaySessions.some((s) => !s.clock_out_at)
        ? null
        : awaySessions.reduce<string | null>(
            (max, s) => (s.clock_out_at && (!max || s.clock_out_at > max) ? s.clock_out_at : max),
            null,
          );
      return (
        <div
          className="w-full h-12 rounded-lg text-[11px] border border-dashed border-gold/40 bg-gold/5 text-gold flex flex-col items-center justify-center px-1"
          title={`${clockedAway.length > 0 ? "Clocked in at" : "Covering"} ${awayNames.join(" + ")} this day`}
        >
          <span className="font-medium truncate max-w-full">
            @ {awayIds.map(shortName).join(" + ")}
          </span>
          {awaySessions.length > 0 ? (
            <span className="opacity-80 truncate max-w-full">
              ✓ in {formatClockTime(awaySessions[0].clock_in_at)}
              {lastOut && <> · out {formatClockTime(lastOut)}</>}
            </span>
          ) : (
            cell &&
            !cell.is_day_off &&
            cell.start_time && (
              <span className="opacity-80 truncate max-w-full">
                {formatShiftRange(false, cell.start_time, cell.end_time)}
              </span>
            )
          )}
        </div>
      );
    }
    // Only THIS store's shifts: a split day's other half belongs to the other
    // store's rota, not to the first-in / last-out shown here.
    const hereSessions = (managerSessionsByKey.get(key) ?? []).filter(
      (s) => s.store_id === activeStoreId,
    );
    const header = managerClockByKey.get(key);
    const clk: {
      clock_in_at: string | null;
      clock_out_at: string | null;
      auto_clocked_out: boolean;
      session_count: number;
      worked_hours: number | null;
    } | null = hereSessions.length
      ? {
          clock_in_at: hereSessions[0].clock_in_at,
          clock_out_at: hereSessions.some((s) => !s.clock_out_at)
            ? null
            : hereSessions.reduce<string | null>(
                (max, s) =>
                  s.clock_out_at && (!max || s.clock_out_at > max) ? s.clock_out_at : max,
                null,
              ),
          auto_clocked_out: hereSessions.some((s) => s.auto_clocked_out),
          session_count: hereSessions.length,
          worked_hours: hereSessions.reduce(
            (sum, s) =>
              s.clock_out_at
                ? sum +
                  Math.max(
                    0,
                    (new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime()) /
                      3_600_000,
                  )
                : sum,
            0,
          ),
        }
      : clockedHere && header && !managerSessionsByKey.has(key)
        ? {
            clock_in_at: header.clock_in_at,
            clock_out_at: header.clock_out_at,
            auto_clocked_out: Boolean(header.auto_clocked_out),
            session_count: Number(header.session_count) || 1,
            worked_hours: header.worked_hours != null ? Number(header.worked_hours) : null,
          }
        : null;
    const isPast = dateIso < todayISO();
    const prevShift = managerShiftByKey.get(
      `${mgr.id}:${toISODate(addDays(d, -1))}`,
    );
    const prefill =
      !cell && prevShift && !prevShift.is_day_off && prevShift.start_time
        ? {
            start: prevShift.start_time.slice(0, 5),
            end: (prevShift.end_time ?? "").slice(0, 5),
          }
        : null;
    // "Came or not" — a past scheduled (non-day-off) shift
    // with no clock-in is a no-show.
    // Booked here but clocked in only at the other store: they turned up, just
    // not here, so that is said instead of "not clocked in".
    const missed =
      isPast && !!cell && !cell.is_day_off && !clk?.clock_in_at && clockedAway.length === 0;
    const cellInner = (
      <>
        {cell ? formatShiftRange(cell.is_day_off, cell.start_time, cell.end_time, cell.is_on_leave) : "—"}
        {clk?.clock_in_at && (
          <div className="text-[9px] text-success mt-0.5">
            ✓ in{" "}
            {new Date(clk.clock_in_at).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {clk.clock_out_at && (
              <>
                {" "}
                · out{" "}
                {new Date(clk.clock_out_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {clk.auto_clocked_out && (
                  <span
                    className="text-warning"
                    title="No clock-out recorded — the scheduled shift end was used."
                  >
                    {" "}
                    (auto)
                  </span>
                )}
              </>
            )}
            {/* Attendance, not the schedule: the times above
                span the whole day, so a split day needs its
                real total spelling out. */}
            {Number(clk.session_count) > 1 && (
              <span
                className="block text-gold"
                title={`${clk.session_count} separate shifts worked this day, ${formatHoursMinsWords(Number(clk.worked_hours ?? 0))} in total excluding the gap between them.`}
              >
                {clk.session_count} shifts worked
                {clk.worked_hours != null && (
                  <> · {formatHoursMinsWords(Number(clk.worked_hours))}</>
                )}
              </span>
            )}
          </div>
        )}
        {missed && (
          <div className="text-[9px] text-danger mt-0.5">✗ not clocked in</div>
        )}
        {!clk?.clock_in_at && clockedAway.length > 0 && (
          <div className="text-[9px] text-gold mt-0.5">
            worked @ {clockedAway.map(shortName).join(" + ")}
          </div>
        )}
      </>
    );
    return isPast ? (
      <div
        className={
          "w-full h-12 max-md:h-auto max-md:min-h-12 max-md:py-2 rounded-lg text-xs max-md:text-sm border flex flex-col items-center justify-center cursor-default opacity-70 " +
          (cell?.is_day_off
            ? dayOffTone(cell.is_on_leave, true)
            : cell?.start_time
              ? "bg-success/5 border-success/20 text-success"
              : "border-dashed border-border text-text-muted")
        }
        title="Past day — view only (locked for editing)"
      >
        {cellInner}
      </div>
    ) : (
      <button
        onClick={() =>
          setEditingManagerShift({
            manager: mgr,
            date: dateIso,
            existing: cell ?? null,
            prefill,
          })
        }
        className={
          "w-full h-12 max-md:h-auto max-md:min-h-12 max-md:py-2 rounded-lg text-xs max-md:text-sm border transition-colors " +
          (cell?.is_day_off
            ? dayOffTone(cell.is_on_leave, false)
            : cell?.start_time
              ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
              : "border-dashed border-border text-text-muted hover:bg-surface-hover")
        }
      >
        {cellInner}
      </button>
    );
  }

  // One employee's cell for one day — shared by the desktop grid and the phone day list.
  function employeeDayCell(emp: RotaEmployee, d: Date): React.ReactNode {
    const dateIso = toISODate(d);
    const dayAll = shiftByKey.get(`${emp.id}:${dateIso}`) ?? [];
    // A day can now hold several shifts; split them by which
    // store they belong to (a shift can sit at another store).
    const localShifts = dayAll.filter((s) => s.store_id === activeStoreId);
    const awayShifts = dayAll.filter((s) => s.store_id !== activeStoreId);
    // Scheduled at ANOTHER store this day (and nothing here). Shows where the
    // person is covering, and on today/future days stays CLICKABLE so a shift
    // can be added here alongside it — a split day across two stores (mornings
    // at one, evening-to-close at the other) has no other way in. Editing the
    // away shift itself still belongs to that store's rota, so the click always
    // opens a NEW shift at the active store. If they also have a shift here,
    // the local cell below takes priority and the away shift is not shown.
    if (localShifts.length === 0 && awayShifts.length > 0) {
      const awayStore = storeById.get(awayShifts[0].store_id);
      const awayPast = dateIso < todayISO();
      const awayInner = (
        <>
          <span className="font-medium truncate max-w-full">
            @ {awayStore?.name?.split(" ")[0] ?? "Away"}
          </span>
          {awayShifts.map(
            (s) =>
              !s.is_day_off &&
              s.start_time && (
                <span key={s.id} className="opacity-80 truncate max-w-full">
                  {formatShiftRange(false, s.start_time, s.end_time)}
                </span>
              ),
          )}
        </>
      );
      const awayClass =
        "w-full min-h-12 h-auto py-1 rounded-lg text-[11px] border border-dashed border-gold/40 bg-gold/5 text-gold flex flex-col items-center justify-center px-1";
      return awayPast ? (
        <div
          className={awayClass + " cursor-default opacity-70"}
          title={`Working at ${awayStore?.name ?? "another store"} this day`}
        >
          {awayInner}
        </div>
      ) : (
        <button
          onClick={() =>
            setEditingShift({
              employee: emp,
              date: dateIso,
              existing: null,
              prefill: null,
              dayShifts: [],
              awayNote: `Also booked at ${awayStore?.name ?? "another store"}${awayShifts
                .filter((s) => !s.is_day_off && s.start_time)
                .map((s) => ` ${formatShiftRange(false, s.start_time, s.end_time)}`)
                .join(",")} this day.`,
            })
          }
          className={awayClass + " transition-colors hover:bg-gold/10"}
          title={`Working at ${awayStore?.name ?? "another store"} this day — click to also book a shift at ${activeStore?.name ?? "this store"}`}
        >
          {awayInner}
        </button>
      );
    }
    // Kept for the ghost/ prefill logic below, which only cares
    // about "is there at least one shift already" — the cell
    // itself renders every one of `localShifts`, not just this.
    const cell = localShifts[0] ?? null;
    const clk = clockByKey.get(`${emp.id}:${dateIso}`);
    // Past days are read-only — managers & admins can view but
    // not edit yesterday or earlier; only today onwards.
    const isPast = dateIso < todayISO();
    // Ghost hint: the employee's recurring schedule for this
    // weekday, shown faintly in empty cells as a suggestion.
    const tmpl = scheduleByEmpDay.get(
      `${emp.id}:${weekdayIndex(d)}`,
    );
    const ghost =
      !cell && tmpl && tmpl.is_working && tmpl.start_time
        ? `${tmpl.start_time.slice(0, 5)}–${(tmpl.end_time ?? "").slice(0, 5)}`
        : null;
    // Previous day's FIRST shift — used to pre-fill a new shift.
    const prevShift = (
      shiftByKey.get(`${emp.id}:${toISODate(addDays(d, -1))}`) ?? []
    )[0];
    const prefill =
      !cell && prevShift && !prevShift.is_day_off && prevShift.start_time
        ? {
            start: prevShift.start_time.slice(0, 5),
            end: (prevShift.end_time ?? "").slice(0, 5),
          }
        : null;
    // Ghost defaults are only actionable on editable days.
    const showGhost = ghost && !isPast;
    const storeAttendance = storeDayAttendance(emp.id, dateIso, clk);
    const cellInner = (
      <>
        {localShifts.length > 0 ? (
          <div className="flex flex-col gap-1">
            {localShifts.map((s) => (
              <div key={s.id}>
                {formatShiftRange(s.is_day_off, s.start_time, s.end_time, s.is_on_leave)}
                {!s.is_day_off && s.shift_type && (
                  <span className="block text-[9px] uppercase tracking-wide opacity-70">
                    {presetShort(s.shift_type)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : showGhost ? (
          <span className="opacity-60">
            {ghost}
            <span className="block text-[9px] uppercase tracking-wide">
              default
            </span>
          </span>
        ) : (
          "—"
        )}
        {clk && storeAttendance.firstInAt && (
          <div className="text-[9px] text-text-muted mt-0.5">
            in {new Date(storeAttendance.firstInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            {/* Labelled as WORKED, on its own line: the row
                above is the scheduled shift, and the two are
                different things on a split day. Counted AT THIS
                STORE — a cross-store day's other half belongs on
                the other store's rota, not this cell. */}
            {storeAttendance.sessionCount > 1 && (
              <span
                className="block text-gold"
                title={`Attendance, not the schedule: ${storeAttendance.sessionCount} separate shifts worked at ${activeStore?.name ?? "this store"} this day, ${formatHoursMinsWords(storeAttendance.workedHours ?? 0)} in total excluding the gap between them.`}
              >
                {storeAttendance.sessionCount} shifts worked
                {storeAttendance.workedHours != null && (
                  <> · {formatHoursMinsWords(storeAttendance.workedHours)}</>
                )}
              </span>
            )}
            {clk.manual_entry && (
              <span
                className="text-warning"
                title={
                  clk.manual_entry_reason
                    ? `Entered by a manager — ${clk.manual_entry_reason}`
                    : "Entered by a manager (no location check)"
                }
              >
                {" "}
                (manual)
              </span>
            )}
          </div>
        )}
      </>
    );
    return isPast ? (
      <div
        className={
          "w-full min-h-12 h-auto py-1 max-md:py-2 rounded-lg text-xs max-md:text-sm border flex flex-col items-center justify-center cursor-default opacity-70 " +
          (cell?.is_day_off
            ? dayOffTone(cell.is_on_leave, true)
            : cell?.start_time
              ? "bg-success/5 border-success/20 text-success"
              : "border-dashed border-border text-text-muted")
        }
        title={
          cell?.same_day_edit_reason
            ? `Reason: ${cell.same_day_edit_reason}`
            : "Past day — view only (locked for editing)"
        }
      >
        {cellInner}
      </div>
    ) : (
      <button
        onClick={() =>
          setEditingShift({
            employee: emp,
            date: dateIso,
            existing: cell ?? null,
            prefill,
            dayShifts: localShifts,
          })
        }
        className={
          "w-full min-h-12 h-auto py-1 max-md:py-2 rounded-lg text-xs max-md:text-sm border transition-colors " +
          (cell?.is_day_off
            ? dayOffTone(cell.is_on_leave, false)
            : cell?.start_time
              ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
              : ghost
                ? "border-dashed border-gold/30 text-text-muted hover:bg-gold/5"
                : "border-dashed border-border text-text-muted hover:bg-surface-hover")
        }
        title={
          cell?.same_day_edit_reason
            ? `Reason: ${cell.same_day_edit_reason}`
            : localShifts.length > 1
              ? `${localShifts.length} shifts — click to manage`
              : ghost
                ? "Default from recurring schedule — click to add this shift"
                : undefined
        }
      >
        {cellInner}
      </button>
    );
  }

  // One cover driver's booking for one day — shared by the desktop grid and the phone day list.
  function coverDayCell(driver: CoverDriver, d: Date): React.ReactNode {
    const dateIso = toISODate(d);
    const cell = coverShiftByKey.get(`${driver.id}:${dateIso}`) ?? null;
    const tmpl = coverScheduleByKey.get(
      `${driver.id}:${weekdayOf(dateIso)}`,
    );
    const eff = resolveCoverDriverShift(cell, tmpl);
    const clk = coverClockByKey.get(`${driver.id}:${dateIso}`);
    const isPast = dateIso < todayISO();
    // Their usual availability pre-fills a new booking, so
    // the common case is two clicks: open, save.
    const prefill =
      !cell && tmpl?.is_working && tmpl.start_time
        ? {
            start: tmpl.start_time.slice(0, 5),
            end: (tmpl.end_time ?? "").slice(0, 5),
          }
        : null;
    const missed =
      isPast && !!cell && !cell.is_day_off && !clk?.clock_in_at;

    const cellInner = (
      <>
        {cell ? (
          formatShiftRange(cell.is_day_off, cell.start_time, cell.end_time, cell.is_on_leave)
        ) : eff && !eff.is_day_off ? (
          <span className="opacity-70">
            {formatShiftRange(false, eff.start_time, eff.end_time)}
            <span className="block text-[9px] uppercase tracking-wide">
              usual
            </span>
          </span>
        ) : (
          "—"
        )}
        {clk?.clock_in_at && (
          <div className="text-[9px] text-success mt-0.5">
            ✓ in{" "}
            {new Date(clk.clock_in_at).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {clk.clock_out_at && (
              <>
                {" "}
                · out{" "}
                {new Date(clk.clock_out_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
            {clk.manual_entry && (
              <span
                className="text-warning"
                title={
                  clk.manual_entry_reason
                    ? `Entered by a manager — ${clk.manual_entry_reason}`
                    : "Entered by a manager (no location check)"
                }
              >
                {" "}
                (manual)
              </span>
            )}
          </div>
        )}
        {missed && (
          <div className="text-[9px] text-danger mt-0.5">
            ✗ not clocked in
          </div>
        )}
      </>
    );

    return isPast ? (
      <div
        className={
          "w-full h-12 max-md:h-auto max-md:min-h-12 max-md:py-2 rounded-lg text-xs max-md:text-sm border flex flex-col items-center justify-center cursor-default opacity-70 " +
          (cell?.is_day_off
            ? dayOffTone(cell.is_on_leave, true)
            : cell?.start_time
              ? "bg-success/5 border-success/20 text-success"
              : "border-dashed border-border text-text-muted")
        }
        title="Past day — view only (locked for editing)"
      >
        {cellInner}
      </div>
    ) : (
      <button
        onClick={() =>
          setEditingCoverShift({
            driver,
            date: dateIso,
            existing: cell,
            prefill,
          })
        }
        className={
          "w-full h-12 max-md:h-auto max-md:min-h-12 max-md:py-2 rounded-lg text-xs max-md:text-sm border transition-colors " +
          (cell?.is_day_off
            ? dayOffTone(cell.is_on_leave, false)
            : cell?.start_time
              ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
              : "border-dashed border-border text-text-muted hover:bg-surface-hover")
        }
      >
        {cellInner}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Store tabs & week nav */}
      <Card className="max-sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-2 flex-wrap items-center">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => setActiveStoreId(store.id)}
                disabled={!isSuperAdmin && userStoreId !== null && userStoreId !== store.id}
                className={
                  "px-4 h-10 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed max-md:flex-1 max-md:px-2 " +
                  (store.id === activeStoreId
                    ? "bg-gold text-black border-gold"
                    : "bg-surface text-text-primary border-border hover:bg-surface-hover")
                }
              >
                {store.name}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={applyDefaults}
              loading={applying}
              title="Fill this week's empty days from each employee's recurring weekly schedule"
              className="w-full sm:w-auto max-md:hidden"
            >
              Apply default schedules
            </Button>
            <ActionMenu
              title="Rota"
              actions={[
                {
                  label: applying ? "Applying default schedules…" : "Apply default schedules",
                  description: "Fill this week's empty days from each person's usual pattern",
                  icon: <CalendarIcon size={18} />,
                  disabled: applying,
                  onSelect: applyDefaults,
                },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftRange(-1)}
              iconLeft={<ChevronLeftIcon size={14} />}
              title={`Back ${rangeDayCount} day${rangeDayCount === 1 ? "" : "s"}`}
              aria-label="Previous"
              className="max-sm:h-11"
            >
              <span className="max-sm:hidden">Prev</span>
            </Button>
            <DateRangePicker
              start={rangeStartIso}
              end={rangeEndIso}
              onApply={setRange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftRange(1)}
              iconRight={<ChevronRightIcon size={14} />}
              title={`Forward ${rangeDayCount} day${rangeDayCount === 1 ? "" : "s"}`}
              aria-label="Next"
              className="max-sm:h-11"
            >
              <span className="max-sm:hidden">Next</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="max-sm:hidden">
              Today
            </Button>
          </div>
        </div>

        {/* Phones: pick the day to show. The grid below needs ~1200px, so a
            phone reads the rota one day at a time instead. */}
        <div className="md:hidden mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-text-muted">
              Showing{" "}
              <span className="font-medium text-text-primary">
                {mobileDay.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                const t = todayISO();
                if (t >= rangeStartIso && t <= rangeEndIso) setMobileDayIso(t);
                else goToday();
              }}
              className="h-8 px-2.5 rounded-lg text-xs font-medium text-gold hover:bg-gold/10"
            >
              Today
            </button>
          </div>
          <div
            ref={dayStripRef}
            className="flex gap-1 overflow-x-auto scrollbar-none snap-x"
          >
            {weekDays.map((d) => {
              const iso = toISODate(d);
              const selected = iso === mobileDayIso;
              const isToday = iso === todayISO();
              return (
                <button
                  key={iso}
                  type="button"
                  data-selected={selected}
                  onClick={() => setMobileDayIso(iso)}
                  className={
                    "snap-center flex-1 min-w-[2.5rem] h-14 rounded-xl border flex flex-col items-center justify-center transition-colors " +
                    (selected
                      ? "bg-gold text-black border-gold"
                      : isToday
                        ? "border-gold/50 text-text-primary bg-gold/5"
                        : "border-border text-text-primary bg-surface")
                  }
                >
                  <span className={"text-[10px] uppercase tracking-wide " + (selected ? "text-black/70" : "text-text-muted")}>
                    {WEEKDAY_SHORT[(d.getDay() + 6) % 7]}
                  </span>
                  <span className="text-base font-semibold tabular-nums leading-tight">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* One rota for everyone at this store — managers, staff and cover drivers
          as groups in a single table, so a day's whole cover reads in one place. */}
      <Card className="overflow-hidden p-0 max-md:p-0">
        <CardHeader
          className="px-5 pt-5 mb-3 flex-row items-start justify-between gap-3 max-md:px-4 max-md:pt-4 max-sm:flex-col"
          action={
            (eligibleVisitors.length > 0 || eligibleManagerVisitors.length > 0) && (
              <select
                className="h-10 min-w-[240px] rounded-xl border border-border bg-surface px-3 text-sm text-text-primary hover:bg-surface-hover cursor-pointer max-sm:w-full"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith("m:")) {
                    setAddedManagerVisitorIds((p) => [...p, v.slice(2)]);
                    setGroupFilter((f) => (f === "all" ? f : "managers"));
                  } else if (v.startsWith("e:")) {
                    setAddedVisitorIds((p) => [...p, v.slice(2)]);
                    setGroupFilter((f) => (f === "all" ? f : "staff"));
                  }
                }}
                title="Add someone from another store to cover a shift here"
              >
                <option value="">+ Add from another store…</option>
                {eligibleManagerVisitors.length > 0 && (
                  <optgroup label="Managers">
                    {eligibleManagerVisitors.map((m) => (
                      <option key={m.id} value={`m:${m.id}`}>
                        {m.name || m.username || "Manager"} —{" "}
                        {storeById.get(m.store_id ?? "")?.name ?? "Other store"}
                      </option>
                    ))}
                  </optgroup>
                )}
                {eligibleVisitors.length > 0 && (
                  <optgroup label="Staff">
                    {eligibleVisitors.map((e) => (
                      <option key={e.id} value={`e:${e.id}`}>
                        {e.name} — {storeById.get(e.store_id ?? "")?.name ?? "Other store"}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )
          }
        >
          <CardTitle>{activeStore?.name ?? "—"} Rota</CardTitle>
          <CardDescription>
            {peopleCount} {peopleCount === 1 ? "person" : "people"}
            {groupCount > 1 ? ` · ${groupSummary}` : ""}
            {totalVisiting > 0 ? ` (${totalVisiting} visiting)` : ""} · Expected wage bill{" "}
            <span className="text-text-primary font-medium">
              {formatGBP(expectedWageBill + expectedCoverBill)}
            </span>
            {hasManagerGroup && (
              <span className="text-text-muted"> · excludes managers&apos; fixed daily wage</span>
            )}
          </CardDescription>
        </CardHeader>

        {groupCount > 1 && (
          <div className="px-5 pb-4 max-md:px-4 flex gap-1.5 overflow-x-auto scrollbar-none">
            {groupChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setGroupFilter(chip.key)}
                aria-pressed={groupFilter === chip.key}
                className={
                  "shrink-0 h-8 px-3 rounded-full border text-xs font-medium transition-colors " +
                  (groupFilter === chip.key
                    ? "bg-gold text-black border-gold"
                    : "bg-surface text-text-subtle border-border hover:bg-surface-hover hover:text-text-primary")
                }
              >
                {chip.label}
                <span className="ml-1.5 tabular-nums opacity-70">{chip.count}</span>
              </button>
            ))}
          </div>
        )}

        <ul className="md:hidden divide-y divide-border border-t border-border">
          {showManagers && (
            <>
              {groupHeadingItem("Managers", MANAGER_NOTE)}
              {activeManagers.length === 0 && (
                <li className="px-4 py-6 text-sm text-center text-text-muted">
                  No managers assigned to this store yet. Add one on the Managers page.
                </li>
              )}
              {activeManagers.map((mgr) => {
                const total = weekManagerTotalHours(mgr.id);
                const drops =
                  (managerDeliveriesByMgr.live.get(mgr.id) ?? 0) +
                  (managerDeliveriesByMgr.extra.get(mgr.id) ?? 0);
                return (
                  <li key={`m:${mgr.id}`} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-text-primary min-w-0 truncate">
                        {mgr.name || mgr.username || "Manager"}
                        {mgr.store_id !== activeStoreId && (
                          <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gold/15 text-gold border border-gold/30 align-middle">
                            visiting
                          </span>
                        )}
                      </p>
                      <p className="shrink-0 text-[11px] text-text-muted tabular-nums">
                        {formatHoursMinsWords(total)}
                        {drops > 0 && <span className="text-gold"> · {drops} drops</span>}
                      </p>
                    </div>
                    {managerDayCell(mgr, mobileDay)}
                  </li>
                );
              })}
            </>
          )}

          {showStaff && (
            <>
              {groupHeadingItem("Staff", STAFF_NOTE)}
              {rotaEmployees.length === 0 && (
                <li className="px-4 py-6 text-sm text-center text-text-muted">
                  No staff on this store&apos;s rota yet. Assign staff to this store in
                  Employees, or add someone from the other store above.
                </li>
              )}
              {rotaEmployees.map((emp) => {
                const total = weekTotalHours(emp.id);
                const cashHrs = weekCashHours(emp);
                const avg = fourWkAvg.get(emp.id) ?? 0;
                const wages = weekWages(emp);
                const variance = avg > 0 ? ((total - avg) / avg) * 100 : 0;
                const flagVariance = avg > 0 && Math.abs(variance) > 20;
                const isDriver = hasRole(emp.position, "Driver");
                const delivery = deliveryByDriver.get(emp.id);
                const wage = wageComplianceForEmployee(emp, minWageBands);
                const underMinWage = wage ? !wage.compliant : false;
                const liveDeliv = liveDeliveriesByEmp.get(emp.id) ?? 0;
                const liveExtra = liveExtraByEmp.get(emp.id) ?? 0;
                return (
                  <li key={`e:${emp.id}`} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {emp.name}
                          {emp.store_id !== activeStoreId && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gold/15 text-gold border border-gold/30 align-middle">
                              visiting
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-text-muted truncate">
                          {emp.position ?? "—"} ·{" "}
                          <span className={underMinWage ? "text-danger font-medium" : ""}>
                            NI £{Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0).toFixed(2)}
                            {underMinWage && " ⚠ below min"}
                          </span>
                          {emp.hourly_cash_rate ? ` · Cash £${Number(emp.hourly_cash_rate).toFixed(2)}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-text-primary">
                          {formatGBP(wages.total)}
                        </p>
                        {wages.cash > 0 && (
                          <p className="text-[10px] text-success tabular-nums">Cash {formatGBP(wages.cash)}</p>
                        )}
                      </div>
                    </div>

                    {employeeDayCell(emp, mobileDay)}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted tabular-nums">
                      <span>
                        Total <span className="text-text-primary font-medium">{formatHoursMinsWords(total)}</span>
                      </span>
                      {cashHrs > 0 && (
                        <span className="text-gold">Cash {formatHoursMinsWords(cashHrs)}</span>
                      )}
                      <span className={flagVariance ? "text-warning" : ""}>
                        4-wk avg {formatHoursMinsWords(avg)}
                        {flagVariance && ` (${variance > 0 ? "+" : ""}${variance.toFixed(0)}%)`}
                      </span>
                      {isDriver && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingDelivery({
                              driver: emp,
                              existing: delivery ?? null,
                              weekDays: weekDays.map((d) => toISODate(d)),
                              events: clocks.filter(
                                (c) =>
                                  c.employee_id === emp.id &&
                                  weekDays.some((d) => toISODate(d) === c.event_date),
                              ),
                            })
                          }
                          className="ml-auto h-7 px-2 rounded-md border border-border text-text-subtle hover:text-text-primary"
                        >
                          Drops{" "}
                          <span className="text-success">Live {liveDeliv}</span>
                          {liveExtra > 0 && <span className="text-gold"> +{liveExtra}</span>}
                          {delivery?.manager_avg_4wk != null && <> · Avg {delivery.manager_avg_4wk}</>}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </>
          )}

          {showCover && (
            <>
              {groupHeadingItem("Cover drivers", COVER_NOTE)}
              {activeCoverDrivers.map((driver) => {
                const total = rangeCoverTotalHours(driver.id);
                const liveDeliv = coverDeliveriesByDriver.live.get(driver.id) ?? 0;
                const liveExtra = coverDeliveriesByDriver.extra.get(driver.id) ?? 0;
                return (
                  <li key={`c:${driver.id}`} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{driver.name}</p>
                        <p className="text-[11px] text-text-muted">
                          {formatGBP(driver.hourly_cash_rate)}/h cash
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-success">
                        {formatGBP(coverWages(driver))}
                      </p>
                    </div>
                    {coverDayCell(driver, mobileDay)}
                    <p className="text-[11px] text-text-muted tabular-nums">
                      Total <span className="text-text-primary font-medium">{formatHoursMinsWords(total)}</span>
                      {(liveDeliv > 0 || liveExtra > 0) && (
                        <>
                          {" · "}
                          <span className="text-success">{liveDeliv} drops</span>
                          {liveExtra > 0 && <span className="text-gold"> (+{liveExtra} extra)</span>}
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </>
          )}

          <li className="px-4 py-3 bg-surface-hover/40 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted tabular-nums">
            <span>
              On shift <span className="text-text-primary font-medium">{bookedHereCount(mobileDay)}</span>
            </span>
            <span>
              Week <span className="text-text-primary font-medium">{formatHoursMinsWords(shownHours)}</span>
            </span>
            {groupFilter !== "managers" && (
              <span className="ml-auto">
                Wages <span className="text-text-primary font-medium">{formatGBP(shownWages)}</span>
              </span>
            )}
          </li>
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-surface-hover z-10 sticky-col">
                  Name
                </th>
                <th className="text-left px-2 py-2">Position</th>
                <th className="text-right px-2 py-2">NI £/h</th>
                <th className="text-right px-2 py-2">Cash £/h</th>
                {weekDays.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="text-center px-2 py-2 min-w-[110px]"
                  >
                    <div>{WEEKDAY_SHORT[(d.getDay() + 6) % 7]}</div>
                    <div className="text-[10px] font-normal text-text-muted normal-case">
                      {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                    </div>
                  </th>
                ))}
                <th className="text-right px-2 py-2">Total hrs</th>
                <th
                  className="text-right px-2 py-2"
                  title="Staff: hours above their weekly NI limit. Cover drivers: every hour."
                >
                  Cash hrs
                </th>
                <th className="text-right px-2 py-2">4-wk avg</th>
                <th
                  className="text-right px-3 py-2"
                  title="Booked hours × rate. Managers are on a fixed daily wage and aren't counted here."
                >
                  Wages
                  <InfoIcon size={11} className="inline ml-1 opacity-60" />
                </th>
                <th className="text-center px-2 py-2">Deliveries</th>
              </tr>
            </thead>
            <tbody>
              {showManagers && (
                <>
                  {groupHeadingRow("Managers", MANAGER_NOTE)}
                  {activeManagers.length === 0 && (
                    <tr className="border-t border-border">
                      <td colSpan={colCount} className="px-4 py-6 text-center text-text-muted">
                        No managers assigned to this store yet. Add one on the Managers page.
                      </td>
                    </tr>
                  )}
                  {activeManagers.map((mgr) => {
                    const total = weekManagerTotalHours(mgr.id);
                    const live = managerDeliveriesByMgr.live.get(mgr.id) ?? 0;
                    const extra = managerDeliveriesByMgr.extra.get(mgr.id) ?? 0;
                    return (
                      <tr
                        key={`m:${mgr.id}`}
                        className="border-t border-border hover:bg-surface-hover/60 transition-colors"
                      >
                        <td className="px-3 py-2 sticky left-0 bg-surface z-10 sticky-col font-medium text-text-primary">
                          {mgr.name || mgr.username || "Manager"}
                          {mgr.store_id !== activeStoreId && (
                            <span
                              className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gold/15 text-gold border border-gold/30 align-middle"
                              title={`Visiting from ${storeById.get(mgr.store_id ?? "")?.name ?? "another store"}`}
                            >
                              visiting
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-text-subtle">Manager</td>
                        <td className="px-2 py-2 text-right text-text-muted">—</td>
                        <td className="px-2 py-2 text-right text-text-muted">—</td>
                        {weekDays.map((d) => {
                          const dateIso = toISODate(d);
                          return (
                            <td
                              key={dateIso}
                              className={
                                "px-1 py-1 text-center align-middle " +
                                (dateIso === todayISO() ? "bg-gold/5" : "")
                              }
                            >
                              {managerDayCell(mgr, d)}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-medium">
                          <HoursMinsDisplay hours={total} />
                        </td>
                        <td className="px-2 py-2 text-right text-text-muted">—</td>
                        <td className="px-2 py-2 text-right text-text-muted">—</td>
                        <td
                          className="px-3 py-2 text-right text-[11px] text-text-muted"
                          title="Fixed daily wage — not hourly, so not part of the rota wage bill"
                        >
                          Fixed daily
                        </td>
                        <td className="px-2 py-2 text-center text-xs tabular-nums">
                          {live + extra === 0 ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            <span
                              className="text-gold font-medium"
                              title={
                                extra > 0
                                  ? `${live} on the round + ${extra} extra, paid at the same per-drop rate`
                                  : "Drops covered on the normal round"
                              }
                            >
                              {live + extra}
                              {extra > 0 && (
                                <span className="text-[10px] text-text-muted"> (+{extra})</span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}

              {showStaff && (
                <>
                  {groupHeadingRow("Staff", STAFF_NOTE)}
                  {rotaEmployees.length === 0 && (
                    <tr className="border-t border-border">
                      <td colSpan={colCount} className="px-4 py-6 text-center text-text-muted">
                        No staff on this store&apos;s rota yet. Assign staff to this store
                        in Employees, or add someone from the other store above.
                      </td>
                    </tr>
                  )}
                  {rotaEmployees.map((emp) => {
                    const total = weekTotalHours(emp.id);
                    const cashHrs = weekCashHours(emp);
                    const avg = fourWkAvg.get(emp.id) ?? 0;
                    const wages = weekWages(emp);
                    const variance =
                      avg > 0 ? ((total - avg) / avg) * 100 : 0;
                    const flagVariance = avg > 0 && Math.abs(variance) > 20;
                    const isDriver = hasRole(emp.position, "Driver");
                    const delivery = deliveryByDriver.get(emp.id);
                    const wage = wageComplianceForEmployee(emp, minWageBands);
                    const underMinWage = wage ? !wage.compliant : false;
                    const liveDeliv = liveDeliveriesByEmp.get(emp.id) ?? 0;
                    const liveExtra = liveExtraByEmp.get(emp.id) ?? 0;

                    return (
                      <tr
                        key={`e:${emp.id}`}
                        className="border-t border-border hover:bg-surface-hover/60 transition-colors"
                      >
                        <td className="px-3 py-2 sticky left-0 bg-surface z-10 sticky-col font-medium text-text-primary">
                          {emp.name}
                          {emp.store_id !== activeStoreId && (
                            <span
                              className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gold/15 text-gold border border-gold/30 align-middle"
                              title={`Visiting from ${storeById.get(emp.store_id ?? "")?.name ?? "another store"}`}
                            >
                              visiting
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-text-subtle">
                          {emp.position ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right text-text-subtle">
                          <span className={underMinWage ? "text-danger font-medium" : ""}>
                            £{Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0).toFixed(2)}
                          </span>
                          {underMinWage && wage && (
                            <span
                              className="block text-[9px] text-danger"
                              title={`Below minimum wage for age ${wage.age}: needs £${wage.required.toFixed(2)}/h (${minWageBands.effective_label})`}
                            >
                              ⚠ below min
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-text-subtle">
                          {emp.hourly_cash_rate
                            ? `£${Number(emp.hourly_cash_rate).toFixed(2)}`
                            : "—"}
                        </td>
                        {weekDays.map((d) => {
                          const dateIso = toISODate(d);
                          return (
                            <td
                              key={dateIso}
                              className={
                                "px-1 py-1 text-center align-middle " +
                                (dateIso === todayISO() ? "bg-gold/5" : "")
                              }
                            >
                              {employeeDayCell(emp, d)}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-medium">
                          <HoursMinsDisplay hours={total} />
                        </td>
                        <td className="px-2 py-2 text-right">
                          {cashHrs > 0 ? (
                            <span className="font-medium text-gold">
                              <HoursMinsDisplay hours={cashHrs} />
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-text-subtle">
                          <span className={flagVariance ? "text-warning" : ""}>
                            <HoursMinsDisplay hours={avg} />
                            {flagVariance && (
                              <span className="ml-1 text-[10px]">
                                ({variance > 0 ? "+" : ""}
                                {variance.toFixed(0)}%)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="font-medium text-text-primary">
                            {formatGBP(wages.total)}
                          </div>
                          <div className="text-[10px] text-text-muted leading-tight mt-0.5">
                            <span>NI {formatGBP(wages.ni)}</span>
                            {wages.cash > 0 && (
                              <span className="block text-success">Cash {formatGBP(wages.cash)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {isDriver ? (
                            <button
                              onClick={() =>
                                setEditingDelivery({
                                  driver: emp,
                                  existing: delivery ?? null,
                                  weekDays: weekDays.map((d) => toISODate(d)),
                                  events: clocks.filter(
                                    (c) =>
                                      c.employee_id === emp.id &&
                                      weekDays.some((d) => toISODate(d) === c.event_date),
                                  ),
                                })
                              }
                              className="text-text-subtle hover:text-text-primary underline-offset-2 hover:underline"
                            >
                              {delivery?.manager_avg_4wk != null
                                ? `Avg ${delivery.manager_avg_4wk}`
                                : "Enter"}
                              {delivery?.vita_mojo_count != null && (
                                <span className="block text-[10px] text-text-muted">
                                  Vita {delivery.vita_mojo_count}
                                </span>
                              )}
                              <span
                                className="block text-[10px] text-success"
                                title="Deliveries logged via clock-out this week"
                              >
                                Live {liveDeliv}
                                {liveExtra > 0 && (
                                  <span className="text-gold"> (+{liveExtra} extra)</span>
                                )}
                              </span>
                            </button>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}

              {showCover && (
                <>
                  {groupHeadingRow("Cover drivers", COVER_NOTE)}
                  {activeCoverDrivers.map((driver) => {
                    const total = rangeCoverTotalHours(driver.id);
                    const rate = Number(driver.hourly_cash_rate) || 0;
                    const liveDeliv = coverDeliveriesByDriver.live.get(driver.id) ?? 0;
                    const liveExtra = coverDeliveriesByDriver.extra.get(driver.id) ?? 0;
                    return (
                      <tr
                        key={`c:${driver.id}`}
                        className="border-t border-border hover:bg-surface-hover/60 transition-colors"
                      >
                        <td className="px-3 py-2 sticky left-0 bg-surface z-10 sticky-col font-medium text-text-primary">
                          {driver.name}
                        </td>
                        <td className="px-2 py-2 text-text-subtle">Cover driver</td>
                        <td className="px-2 py-2 text-right text-text-muted">—</td>
                        <td className="px-2 py-2 text-right text-text-subtle">{formatGBP(rate)}</td>
                        {weekDays.map((d) => {
                          const dateIso = toISODate(d);
                          return (
                            <td
                              key={dateIso}
                              className={
                                "px-1 py-1 text-center align-middle " +
                                (dateIso === todayISO() ? "bg-gold/5" : "")
                              }
                            >
                              {coverDayCell(driver, d)}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-medium">
                          <HoursMinsDisplay hours={total} />
                        </td>
                        {/* Cash only — no NI split, so every booked hour is cash. */}
                        <td className="px-2 py-2 text-right">
                          {total > 0 ? (
                            <span className="font-medium text-gold">
                              <HoursMinsDisplay hours={total} />
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-text-muted">—</td>
                        <td className="px-3 py-2 text-right">
                          <div className="font-medium text-success">{formatGBP(total * rate)}</div>
                          <div className="text-[10px] text-text-muted leading-tight mt-0.5">Cash</div>
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {liveDeliv > 0 || liveExtra > 0 ? (
                            <span
                              className="text-success"
                              title="Deliveries logged via clock-out in this range"
                            >
                              {liveDeliv}
                              {liveExtra > 0 && (
                                <span className="text-gold"> (+{liveExtra} extra)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-hover text-xs">
                <td className="px-3 py-2.5 sticky left-0 bg-surface-hover z-10 sticky-col font-semibold text-text-primary">
                  {groupChips.find((c) => c.key === groupFilter)?.label ?? "Everyone"}
                </td>
                <td colSpan={3} className="px-2 py-2.5 text-text-muted">
                  On shift
                </td>
                {weekDays.map((d) => {
                  const dateIso = toISODate(d);
                  return (
                    <td
                      key={dateIso}
                      className={
                        "px-2 py-2.5 text-center tabular-nums text-text-subtle " +
                        (dateIso === todayISO() ? "bg-gold/5" : "")
                      }
                    >
                      {bookedHereCount(d)}
                    </td>
                  );
                })}
                <td className="px-2 py-2.5 text-right font-semibold text-text-primary">
                  <HoursMinsDisplay hours={shownHours} />
                </td>
                <td className="px-2 py-2.5 text-right">
                  {shownCashHours > 0 ? (
                    <span className="font-medium text-gold">
                      <HoursMinsDisplay hours={shownCashHours} />
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td />
                <td className="px-3 py-2.5 text-right font-semibold text-text-primary">
                  {groupFilter === "managers" ? (
                    <span className="text-text-muted font-normal">—</span>
                  ) : (
                    formatGBP(shownWages)
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Modals */}
      {editingShift && (
        <ShiftEditModal
          employee={editingShift.employee}
          storeId={activeStoreId}
          shiftDate={editingShift.date}
          existing={editingShift.existing}
          dayShifts={editingShift.dayShifts}
          awayNote={editingShift.awayNote}
          shiftTimes={activeStore?.shift_times ?? shiftTimes}
          prefill={editingShift.prefill}
          onClose={() => setEditingShift(null)}
          onSaved={() => {
            setEditingShift(null);
            toast.success("Shift updated");
            router.refresh();
          }}
        />
      )}
      {editingDelivery && (
        <DeliveryEditModal
          driver={editingDelivery.driver}
          storeId={activeStoreId}
          weekStartIso={toISODate(weekStart)}
          existing={editingDelivery.existing}
          weekDays={editingDelivery.weekDays}
          events={editingDelivery.events}
          onClose={() => setEditingDelivery(null)}
          onSaved={() => {
            setEditingDelivery(null);
            toast.success("Deliveries saved");
            router.refresh();
          }}
        />
      )}
      {editingCoverShift && (
        <CoverDriverShiftEditModal
          driver={editingCoverShift.driver}
          storeId={activeStoreId}
          shiftDate={editingCoverShift.date}
          existing={editingCoverShift.existing}
          prefill={editingCoverShift.prefill}
          onClose={() => setEditingCoverShift(null)}
          onSaved={() => {
            setEditingCoverShift(null);
            toast.success("Cover shift updated");
            router.refresh();
          }}
        />
      )}
      {editingManagerShift && (
        <ManagerShiftEditModal
          manager={editingManagerShift.manager}
          storeId={activeStoreId}
          shiftDate={editingManagerShift.date}
          existing={editingManagerShift.existing}
          prefill={editingManagerShift.prefill}
          onClose={() => setEditingManagerShift(null)}
          onSaved={() => {
            setEditingManagerShift(null);
            toast.success("Shift updated");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
