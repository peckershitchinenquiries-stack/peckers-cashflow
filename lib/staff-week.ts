// =============================================================
// Weekly Summary (Employees → Weekly Summary tab) — pure builder.
//
// One read-only view of a Mon–Sun work week per person: every shift's clock
// times, worked vs approved hours, the NI/cash split, deliveries and what lands
// on the Tuesday payout. It writes nothing and owns no rule of its own:
//
//   - money comes from buildWageLinesForStore / buildManagerWageLines, the exact
//     functions the payout sheet calls, so the two can never disagree;
//   - NI hours are "approved minus cash", i.e. whatever the payout's weekly rule
//     did NOT pay in cash. This is the WEEKLY rule — /ni-monthly caps a calendar
//     month instead (Update 168), so weekly figures won't sum to it.
// =============================================================

import {
  DELIVERY_PETROL_RATE,
  buildCoverDriverWageLines,
  buildManagerWageLines,
  buildWageLinesForStore,
  type StoreClockSessionRow,
  round2,
  type CoverDriverPayRow,
  type ManagerPayee,
  type ManagerPayRow,
  type StoreClockRow,
} from "@/lib/cash-flow";
import { resolvePayRates } from "@/lib/employee-analytics";
import type { Employee, WageLine } from "@/lib/types";
import {
  addDays,
  clockedHours,
  dayWorkedHours,
  parseISODate,
  roundHoursToMinute,
  toISODate,
} from "@/lib/utils";

// ---------------- inputs ----------------

export type StaffWeekClockRow = StoreClockRow & {
  id: string;
  manual_entry?: boolean | null;
  auto_clocked_out?: boolean | null;
};

type DropColumns = {
  short_deliveries_count?: number | null;
  long_deliveries_count?: number | null;
  extra_short_deliveries?: number | null;
  extra_long_deliveries?: number | null;
};

export type StaffWeekSessionRow = DropColumns & {
  clock_event_id: string;
  store_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  manual_entry?: boolean | null;
  auto_clocked_out?: boolean | null;
  hours_approved?: boolean | null;
  approved_hours?: number | string | null;
};

export type StaffWeekManager = ManagerPayee & {
  store_id: string | null;
  fixed_daily_wage?: number | null;
};

export type StaffWeekManagerDay = ManagerPayRow &
  DropColumns & {
    id: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    worked_hours?: number | string | null;
    manual_entry?: boolean | null;
    auto_clocked_out?: boolean | null;
  };

export type StaffWeekManagerSession = DropColumns & {
  clock_event_id: string;
  store_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  manual_entry?: boolean | null;
  auto_clocked_out?: boolean | null;
  deliveries_approved?: boolean | null;
  deliveries_only?: boolean | null;
};

export type StaffWeekCoverDriver = {
  id: string;
  name: string;
  store_id: string | null;
  hourly_cash_rate: number | string | null;
  short_delivery_rate: number | string | null;
  long_delivery_rate: number | string | null;
  is_active: boolean | null;
};

/** cover_driver_clock_events — one row per driver per day, no child sessions. */
export type StaffWeekCoverClock = DropColumns & {
  cover_driver_id: string;
  store_id: string;
  event_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  manual_entry?: boolean | null;
  auto_clocked_out?: boolean | null;
};

/** A rota booking row from rota_shifts / manager_shifts / cover_driver_shifts. */
export type StaffWeekBookingRow = {
  /** Payee key: `emp:<id>`, `mgr:<id>` or `cd:<id>`. */
  person: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean | null;
  is_on_leave?: boolean | null;
};

/** A line on a CONFIRMED payout for the week, flattened with its store. */
export type StaffWeekFrozenLine = {
  store_id: string;
  employee_id: string | null;
  manager_id: string | null;
  cover_driver_id: string | null;
  total_payment: number | string;
};

// ---------------- outputs ----------------

export type Drops = { sd: number; ld: number; sm: number; lm: number };

export type StaffWeekShift = {
  clockIn: string | null;
  clockOut: string | null;
  /** Clocked duration; 0 while the shift is open or for a drops-only entry. */
  hours: number;
  approved: boolean;
  /** The manager's correction for this shift, when one was made. */
  approvedHours: number | null;
  storeId: string | null;
  manual: boolean;
  autoClockedOut: boolean;
  /** A manager's drops recorded without clock times (migration 037). */
  deliveriesOnly: boolean;
  /** A cover driver's approved day with no clock record behind it. */
  approvedWithoutClock: boolean;
  drops: Drops;
};

/** The rota's plan for a day nobody clocked. */
export type StaffWeekBooking =
  | { dayOff: true; onLeave: boolean }
  | { dayOff: false; start: string | null; end: string | null };

export type StaffWeekDayStatus = "approved" | "pending" | "partial" | "open" | "no-drops";

export type StaffWeekDay = {
  date: string;
  /** The store the day is billed to — the same field the payout groups by. */
  storeId: string | null;
  clockIn: string | null;
  clockOut: string | null;
  workedHours: number;
  /** Payable hours (employees only). Managers' hours are never paid here. */
  approvedHours: number;
  pendingHours: number;
  status: StaffWeekDayStatus;
  shifts: StaffWeekShift[];
  drops: Drops;
  approvedDrops: Drops;
  manual: boolean;
  autoClockedOut: boolean;
};

export type StaffWeekStoreLine = {
  storeId: string;
  cashHours: number;
  cashRate: number;
  cashWage: number;
  drops: Drops;
  deliveryWages: number;
  total: number;
  /** What the CONFIRMED payout for this store paid; null while it isn't confirmed. */
  frozenTotal: number | null;
};

export type StaffWeekPerson = {
  key: string;
  kind: "employee" | "manager" | "cover_driver";
  id: string;
  name: string;
  role: string | null;
  homeStoreId: string | null;
  isDriver: boolean;
  left: boolean;
  rates: {
    cash: number;
    ni: number;
    bankLimit: number;
    paidAnyCash: boolean;
    short: number;
    long: number;
    shortMisc: number;
    longMisc: number;
  };
  /** Admin viewers only. Display — this app never pays it. */
  fixedDailyWage: number | null;
  /** Mon..Sun; null = no clock record that day. */
  days: (StaffWeekDay | null)[];
  /** Mon..Sun rota booking; null = nothing on the rota that day. */
  bookings: (StaffWeekBooking | null)[];
  totals: {
    worked: number;
    approved: number;
    pendingHours: number;
    pendingDrops: number;
    niHours: number;
    cashHours: number;
    niPay: number;
    cashWage: number;
    drops: Drops;
    payableDrops: Drops;
    deliveryWages: number;
    cashDue: number;
    daysWorked: number;
    openDays: number;
  };
  stores: StaffWeekStoreLine[];
  /** Every store a day this week is billed to. */
  storeIds: string[];
  /** A confirmed payout paid a different figure than the live one computes now. */
  payoutMismatch: boolean;
};

// ---------------- helpers ----------------

const ZERO_DROPS: Drops = { sd: 0, ld: 0, sm: 0, lm: 0 };

function count(v: unknown): number {
  return Math.max(0, Math.round(Number(v) || 0));
}

function rawDrops(r: DropColumns): Drops {
  return {
    sd: count(r.short_deliveries_count),
    ld: count(r.long_deliveries_count),
    sm: count(r.extra_short_deliveries),
    lm: count(r.extra_long_deliveries),
  };
}

function approvedDropsOf(r: {
  approved_short_deliveries_count?: number | null;
  approved_long_deliveries_count?: number | null;
  approved_extra_short_deliveries?: number | null;
  approved_extra_long_deliveries?: number | null;
}): Drops {
  return {
    sd: count(r.approved_short_deliveries_count),
    ld: count(r.approved_long_deliveries_count),
    sm: count(r.approved_extra_short_deliveries),
    lm: count(r.approved_extra_long_deliveries),
  };
}

export function addDrops(a: Drops, b: Drops): Drops {
  return { sd: a.sd + b.sd, ld: a.ld + b.ld, sm: a.sm + b.sm, lm: a.lm + b.lm };
}

export function dropsTotal(d: Drops): number {
  return d.sd + d.ld + d.sm + d.lm;
}

function lineDrops(l: WageLine): Drops {
  return {
    sd: l.short_deliveries_count,
    ld: l.long_deliveries_count,
    sm: l.short_misc_count,
    lm: l.long_misc_count,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = out.get(k) ?? [];
    arr.push(r);
    out.set(k, arr);
  }
  return out;
}

function byClockIn<T extends { clock_in_at: string }>(a: T, b: T) {
  return a.clock_in_at.localeCompare(b.clock_in_at);
}

function shiftHours(s: { clock_in_at: string; clock_out_at: string | null }): number {
  return s.clock_out_at ? roundHoursToMinute(clockedHours(s.clock_in_at, s.clock_out_at)) : 0;
}

export function weekDates(weekStart: string): string[] {
  const start = parseISODate(weekStart);
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)));
}

type StoreLineBuild = Omit<StaffWeekStoreLine, "frozenTotal">;

function toStoreLine(storeId: string, l: WageLine): StoreLineBuild {
  return {
    storeId,
    cashHours: l.cash_hours,
    cashRate: l.cash_rate,
    cashWage: l.cash_wage,
    drops: lineDrops(l),
    deliveryWages: l.delivery_wages,
    total: l.total_payment,
  };
}

/**
 * Attach what the confirmed payouts actually paid. A person paid on a confirmed
 * sheet who no longer computes a line (an approval withdrawn afterwards) still
 * gets a zero live line, so the difference is visible rather than silent.
 */
function withFrozen(
  live: StoreLineBuild[],
  payeeKey: string,
  frozen: Map<string, number>,
  confirmedStores: Set<string>,
): StaffWeekStoreLine[] {
  const out: StaffWeekStoreLine[] = live.map((l) => ({
    ...l,
    frozenTotal: confirmedStores.has(l.storeId)
      ? frozen.get(`${l.storeId}|${payeeKey}`) ?? 0
      : null,
  }));
  for (const storeId of confirmedStores) {
    if (out.some((l) => l.storeId === storeId)) continue;
    const paid = frozen.get(`${storeId}|${payeeKey}`);
    if (paid == null) continue;
    out.push({
      storeId,
      cashHours: 0,
      cashRate: 0,
      cashWage: 0,
      drops: ZERO_DROPS,
      deliveryWages: 0,
      total: 0,
      frozenTotal: paid,
    });
  }
  return out;
}

function statusFromFlags(flags: boolean[], open: boolean, empty: StaffWeekDayStatus) {
  if (open) return "open" as const;
  if (flags.length === 0) return empty;
  const n = flags.filter(Boolean).length;
  if (n === flags.length) return "approved" as const;
  return n === 0 ? ("pending" as const) : ("partial" as const);
}

function summariseLines(lines: StaffWeekStoreLine[]) {
  let cashHours = 0;
  let cashWage = 0;
  let deliveryWages = 0;
  let cashDue = 0;
  let payableDrops = ZERO_DROPS;
  for (const l of lines) {
    cashHours += l.cashHours;
    cashWage += l.cashWage;
    deliveryWages += l.deliveryWages;
    cashDue += l.total;
    payableDrops = addDrops(payableDrops, l.drops);
  }
  return {
    cashHours: roundHoursToMinute(cashHours),
    cashWage: round2(cashWage),
    deliveryWages: round2(deliveryWages),
    cashDue: round2(cashDue),
    payableDrops,
  };
}

const hasMismatch = (lines: StaffWeekStoreLine[]) =>
  lines.some((l) => l.frozenTotal != null && Math.abs(l.frozenTotal - l.total) > 0.005);

/**
 * A day with any working booking reads as booked, spanning its earliest start to
 * latest end; only a day whose every cell is "Day Off" reads as one, and as
 * leave when any of those cells is "On Leave".
 */
function bookingsFor(
  rows: StaffWeekBookingRow[] | undefined,
  dayIndex: Map<string, number>,
): (StaffWeekBooking | null)[] {
  const out: (StaffWeekBooking | null)[] = Array(7).fill(null);
  for (const r of rows ?? []) {
    const i = dayIndex.get(r.shift_date);
    if (i == null) continue;
    const prev = out[i];
    if (r.is_day_off) {
      if (!prev || prev.dayOff) {
        out[i] = { dayOff: true, onLeave: !!r.is_on_leave || (prev?.dayOff === true && prev.onLeave) };
      }
      continue;
    }
    if (!prev || prev.dayOff) {
      out[i] = { dayOff: false, start: r.start_time, end: r.end_time };
      continue;
    }
    out[i] = {
      dayOff: false,
      start: [prev.start, r.start_time].filter((t): t is string => !!t).sort()[0] ?? null,
      end: [prev.end, r.end_time].filter((t): t is string => !!t).sort().pop() ?? null,
    };
  }
  return out;
}

// ---------------- builder ----------------

export function buildStaffWeek(input: {
  weekStart: string;
  employees: Employee[];
  clocks: StaffWeekClockRow[];
  sessions: StaffWeekSessionRow[];
  managers: StaffWeekManager[];
  managerDays: StaffWeekManagerDay[];
  managerSessions: StaffWeekManagerSession[];
  coverDrivers: StaffWeekCoverDriver[];
  coverClocks: StaffWeekCoverClock[];
  /** Approved cover_driver_hours_computed rows — the only ones the payout pays. */
  coverApproved: CoverDriverPayRow[];
  bookings: StaffWeekBookingRow[];
  frozenLines: StaffWeekFrozenLine[];
  confirmedStoreIds: string[];
  includeFixedWage: boolean;
}): StaffWeekPerson[] {
  const dates = weekDates(input.weekStart);
  const dayIndex = new Map(dates.map((d, i) => [d, i]));
  const bookingsByPerson = groupBy(input.bookings, (b) => b.person);
  const confirmed = new Set(input.confirmedStoreIds);
  const frozen = new Map<string, number>();
  for (const f of input.frozenLines) {
    const payee = f.employee_id
      ? `emp:${f.employee_id}`
      : f.manager_id
        ? `mgr:${f.manager_id}`
        : f.cover_driver_id
          ? `cd:${f.cover_driver_id}`
          : null;
    if (!payee) continue;
    const k = `${f.store_id}|${payee}`;
    frozen.set(k, round2((frozen.get(k) ?? 0) + (Number(f.total_payment) || 0)));
  }

  const people: StaffWeekPerson[] = [];

  // ---- employees ----
  const clocksByEmp = groupBy(
    input.clocks.filter((c) => dayIndex.has(c.event_date)),
    (c) => c.employee_id,
  );
  const sessionsByDay = groupBy(input.sessions, (s) => s.clock_event_id);

  for (const emp of input.employees) {
    const empClocks = clocksByEmp.get(emp.id);
    if (!empClocks?.length) continue;
    const rates = resolvePayRates(emp);
    const days: (StaffWeekDay | null)[] = Array(7).fill(null);
    // The shifts as the PAYOUT reads them — each carrying the store it was
    // worked at, so a day split across both stores pays each its own half.
    const empSessions: StoreClockSessionRow[] = [];

    for (const c of empClocks) {
      const sessions = [...(sessionsByDay.get(c.id) ?? [])].sort(byClockIn);
      for (const x of sessions)
        empSessions.push({ ...x, employee_id: emp.id, event_date: c.event_date });
      const shifts: StaffWeekShift[] = sessions.length
        ? sessions.map((s) => ({
            clockIn: s.clock_in_at,
            clockOut: s.clock_out_at,
            hours: shiftHours(s),
            approved: !!s.hours_approved,
            approvedHours: s.hours_approved && s.approved_hours != null ? Number(s.approved_hours) : null,
            storeId: s.store_id,
            manual: !!s.manual_entry,
            autoClockedOut: !!s.auto_clocked_out,
            deliveriesOnly: false,
            approvedWithoutClock: false,
            drops: rawDrops(s),
          }))
        : // A pre-029 day has no session rows; its header IS the one shift.
          c.clock_in_at
          ? [
              {
                clockIn: c.clock_in_at,
                clockOut: c.clock_out_at,
                hours: roundHoursToMinute(dayWorkedHours(c)),
                approved: !!c.hours_approved,
                approvedHours: c.hours_approved && c.approved_hours != null ? Number(c.approved_hours) : null,
                storeId: c.store_id,
                manual: !!c.manual_entry,
                autoClockedOut: !!c.auto_clocked_out,
                deliveriesOnly: false,
                approvedWithoutClock: false,
                drops: rawDrops(c),
              },
            ]
          : [];
      const open = !!c.clock_in_at && !c.clock_out_at;
      const completed = shifts.filter((s) => s.clockOut);
      days[dayIndex.get(c.event_date)!] = {
        date: c.event_date,
        storeId: c.store_id,
        clockIn: c.clock_in_at,
        clockOut: c.clock_out_at,
        workedHours: roundHoursToMinute(dayWorkedHours(c)),
        // Mirrors resolveWorkingDays: approved hours count only on a clocked day.
        approvedHours: c.clock_in_at ? roundHoursToMinute(Number(c.approved_hours) || 0) : 0,
        pendingHours: roundHoursToMinute(
          completed.filter((s) => !s.approved).reduce((sum, s) => sum + s.hours, 0),
        ),
        status: statusFromFlags(completed.map((s) => s.approved), open, "pending"),
        shifts,
        drops: rawDrops(c),
        approvedDrops: approvedDropsOf(c),
        manual: !!c.manual_entry || shifts.some((s) => s.manual),
        autoClockedOut: !!c.auto_clocked_out || shifts.some((s) => s.autoClockedOut),
      };
    }

    // Off the SHIFTS as well as the days: a store the person only visited for
    // the second half of a day appears on no day header.
    const storeIds = Array.from(
      new Set([
        ...empClocks.map((c) => c.store_id),
        ...empSessions.map((x) => x.store_id).filter((x): x is string => !!x),
      ]),
    );
    const live: StoreLineBuild[] = [];
    for (const storeId of storeIds) {
      const [line] = buildWageLinesForStore(storeId, [emp], empClocks, empSessions);
      if (line) live.push(toStoreLine(storeId, line));
    }
    const stores = withFrozen(live, `emp:${emp.id}`, frozen, confirmed);
    const money = summariseLines(stores);

    const present = days.filter((d): d is StaffWeekDay => d !== null);
    const approved = roundHoursToMinute(present.reduce((s, d) => s + d.approvedHours, 0));
    const niHours = roundHoursToMinute(Math.max(0, approved - money.cashHours));
    const drops = present.reduce((acc, d) => addDrops(acc, d.drops), ZERO_DROPS);

    people.push({
      key: `emp:${emp.id}`,
      kind: "employee",
      id: emp.id,
      name: emp.name,
      role: emp.position ?? null,
      homeStoreId: emp.store_id,
      isDriver: rates.isDriver,
      left: emp.employment_status === "left",
      rates: {
        cash: rates.cashRate,
        ni: rates.niRate,
        bankLimit: rates.bankLimit,
        paidAnyCash: rates.paidAnyCash,
        short: rates.shortRate,
        long: rates.longRate,
        shortMisc: rates.shortRate,
        longMisc: rates.longRate,
      },
      fixedDailyWage: null,
      days,
      bookings: bookingsFor(bookingsByPerson.get(`emp:${emp.id}`), dayIndex),
      totals: {
        worked: roundHoursToMinute(present.reduce((s, d) => s + d.workedHours, 0)),
        approved,
        pendingHours: roundHoursToMinute(present.reduce((s, d) => s + d.pendingHours, 0)),
        pendingDrops: rates.isDriver
          ? Math.max(0, dropsTotal(drops) - dropsTotal(money.payableDrops))
          : 0,
        niHours,
        cashHours: money.cashHours,
        niPay: round2(niHours * rates.niRate),
        cashWage: money.cashWage,
        drops,
        payableDrops: money.payableDrops,
        deliveryWages: money.deliveryWages,
        cashDue: money.cashDue,
        daysWorked: present.filter((d) => d.clockIn).length,
        openDays: present.filter((d) => d.status === "open").length,
      },
      stores,
      storeIds,
      payoutMismatch: hasMismatch(stores),
    });
  }

  // ---- managers ----
  const mgrDaysBy = groupBy(
    input.managerDays.filter((d) => dayIndex.has(d.event_date)),
    (d) => d.manager_id,
  );
  const mgrSessionsByDay = groupBy(input.managerSessions, (s) => s.clock_event_id);

  for (const mgr of input.managers) {
    const mDays = mgrDaysBy.get(mgr.id);
    if (!mDays?.length) continue;
    const days: (StaffWeekDay | null)[] = Array(7).fill(null);

    for (const d of mDays) {
      const sessions = [...(mgrSessionsByDay.get(d.id) ?? [])].sort(byClockIn);
      const shifts: StaffWeekShift[] = sessions.length
        ? sessions.map((s) => ({
            clockIn: s.deliveries_only ? null : s.clock_in_at,
            clockOut: s.deliveries_only ? null : s.clock_out_at,
            hours: s.deliveries_only ? 0 : shiftHours(s),
            approved: !!s.deliveries_approved,
            approvedHours: null,
            storeId: s.store_id,
            manual: !!s.manual_entry,
            autoClockedOut: !!s.auto_clocked_out,
            deliveriesOnly: !!s.deliveries_only,
            approvedWithoutClock: false,
            drops: rawDrops(s),
          }))
        : d.clock_in_at
          ? [
              {
                clockIn: d.clock_in_at,
                clockOut: d.clock_out_at,
                hours: roundHoursToMinute(dayWorkedHours(d)),
                approved: dropsTotal(approvedDropsOf(d)) > 0,
                approvedHours: null,
                storeId: d.store_id,
                manual: !!d.manual_entry,
                autoClockedOut: !!d.auto_clocked_out,
                deliveriesOnly: false,
                approvedWithoutClock: false,
                drops: rawDrops(d),
              },
            ]
          : [];
      const open = !!d.clock_in_at && !d.clock_out_at;
      // A manager's hours are never signed off — only their drops are.
      const withDrops = shifts.filter(
        (s) => (s.clockOut || s.deliveriesOnly) && dropsTotal(s.drops) > 0,
      );
      days[dayIndex.get(d.event_date)!] = {
        date: d.event_date,
        storeId: d.store_id,
        clockIn: d.clock_in_at,
        clockOut: d.clock_out_at,
        workedHours: roundHoursToMinute(dayWorkedHours(d)),
        approvedHours: 0,
        pendingHours: 0,
        status: statusFromFlags(withDrops.map((s) => s.approved), open, "no-drops"),
        shifts,
        drops: rawDrops(d),
        approvedDrops: approvedDropsOf(d),
        manual: !!d.manual_entry || shifts.some((s) => s.manual),
        autoClockedOut: !!d.auto_clocked_out || shifts.some((s) => s.autoClockedOut),
      };
    }

    const storeIds = Array.from(
      new Set(mDays.map((d) => d.store_id).filter((s): s is string => !!s)),
    );
    const live: StoreLineBuild[] = [];
    for (const storeId of storeIds) {
      const [line] = buildManagerWageLines(storeId, [mgr], mDays);
      if (line) live.push(toStoreLine(storeId, line));
    }
    const stores = withFrozen(live, `mgr:${mgr.id}`, frozen, confirmed);
    const money = summariseLines(stores);
    const present = days.filter((d): d is StaffWeekDay => d !== null);
    const drops = present.reduce((acc, d) => addDrops(acc, d.drops), ZERO_DROPS);
    const shortRate =
      mgr.short_delivery_rate != null ? Number(mgr.short_delivery_rate) : DELIVERY_PETROL_RATE;
    const longRate =
      mgr.long_delivery_rate != null ? Number(mgr.long_delivery_rate) : DELIVERY_PETROL_RATE;

    people.push({
      key: `mgr:${mgr.id}`,
      kind: "manager",
      id: mgr.id,
      name: mgr.name ?? "Manager",
      role: "Manager",
      homeStoreId: mgr.store_id,
      isDriver: true,
      left: false,
      rates: {
        cash: 0,
        ni: 0,
        bankLimit: 0,
        paidAnyCash: false,
        short: shortRate,
        long: longRate,
        shortMisc:
          mgr.extra_short_delivery_rate != null ? Number(mgr.extra_short_delivery_rate) : shortRate,
        longMisc:
          mgr.extra_long_delivery_rate != null ? Number(mgr.extra_long_delivery_rate) : longRate,
      },
      fixedDailyWage:
        input.includeFixedWage && mgr.fixed_daily_wage != null ? Number(mgr.fixed_daily_wage) : null,
      days,
      bookings: bookingsFor(bookingsByPerson.get(`mgr:${mgr.id}`), dayIndex),
      totals: {
        worked: roundHoursToMinute(present.reduce((s, d) => s + d.workedHours, 0)),
        approved: 0,
        pendingHours: 0,
        pendingDrops: Math.max(0, dropsTotal(drops) - dropsTotal(money.payableDrops)),
        niHours: 0,
        cashHours: 0,
        niPay: 0,
        cashWage: 0,
        drops,
        payableDrops: money.payableDrops,
        deliveryWages: money.deliveryWages,
        cashDue: money.cashDue,
        daysWorked: present.filter((d) => d.clockIn).length,
        openDays: present.filter((d) => d.status === "open").length,
      },
      stores,
      storeIds,
      payoutMismatch: hasMismatch(stores),
    });
  }

  // ---- cover drivers ----
  // A single shift per day, and approval is the presence of the approved
  // cover_driver_hours row — its snapshot, not the clock, is what gets paid.
  const coverClocksBy = groupBy(
    input.coverClocks.filter((c) => dayIndex.has(c.event_date)),
    (c) => c.cover_driver_id,
  );
  const coverApprovedBy = groupBy(
    input.coverApproved.filter((r) => r.approved && dayIndex.has(r.work_date)),
    (r) => r.cover_driver_id,
  );

  for (const cd of input.coverDrivers) {
    const cClocks = coverClocksBy.get(cd.id) ?? [];
    const cApproved = coverApprovedBy.get(cd.id) ?? [];
    if (!cClocks.length && !cApproved.length) continue;
    const approvedByDate = new Map(cApproved.map((r) => [r.work_date, r]));
    const days: (StaffWeekDay | null)[] = Array(7).fill(null);

    for (const date of dates) {
      const c = cClocks.find((x) => x.event_date === date);
      const a = approvedByDate.get(date);
      if (!c && !a) continue;
      const approvedHours = a ? roundHoursToMinute(Number(a.total_hours_worked) || 0) : 0;
      const approvedDrops: Drops = a
        ? {
            sd: count(a.short_deliveries),
            ld: count(a.long_deliveries),
            sm: count(a.extra_short_deliveries),
            lm: count(a.extra_long_deliveries),
          }
        : ZERO_DROPS;
      const clocked = !!c?.clock_in_at;
      const worked = c?.clock_in_at ? shiftHours({ ...c, clock_in_at: c.clock_in_at }) : 0;
      const open = clocked && !c?.clock_out_at;
      const drops = c ? rawDrops(c) : approvedDrops;
      days[dayIndex.get(date)!] = {
        date,
        storeId: c?.store_id ?? a?.store_id ?? null,
        clockIn: c?.clock_in_at ?? null,
        clockOut: c?.clock_out_at ?? null,
        workedHours: worked,
        approvedHours,
        pendingHours: !a && !open ? worked : 0,
        status: open ? "open" : a ? "approved" : "pending",
        shifts: [
          {
            clockIn: c?.clock_in_at ?? null,
            clockOut: c?.clock_out_at ?? null,
            hours: worked,
            approved: !!a,
            approvedHours: a ? approvedHours : null,
            storeId: c?.store_id ?? a?.store_id ?? null,
            manual: !!c?.manual_entry,
            autoClockedOut: !!c?.auto_clocked_out,
            deliveriesOnly: false,
            approvedWithoutClock: !clocked,
            drops,
          },
        ],
        drops,
        approvedDrops,
        manual: !!c?.manual_entry,
        autoClockedOut: !!c?.auto_clocked_out,
      };
    }

    const storeIds = Array.from(
      new Set([...cClocks.map((c) => c.store_id), ...cApproved.map((r) => r.store_id)]),
    );
    const live: StoreLineBuild[] = [];
    for (const storeId of storeIds) {
      const [line] = buildCoverDriverWageLines(storeId, cApproved);
      if (line) live.push(toStoreLine(storeId, line));
    }
    const stores = withFrozen(live, `cd:${cd.id}`, frozen, confirmed);
    const money = summariseLines(stores);
    const present = days.filter((d): d is StaffWeekDay => d !== null);
    const drops = present.reduce((acc, d) => addDrops(acc, d.drops), ZERO_DROPS);
    const pendingDrops = present
      .filter((d) => d.status !== "approved")
      .reduce((s, d) => s + dropsTotal(d.drops), 0);
    const cashRate = Number(cd.hourly_cash_rate) || 0;
    const shortRate = Number(cd.short_delivery_rate) || 0;
    const longRate = Number(cd.long_delivery_rate) || 0;

    people.push({
      key: `cd:${cd.id}`,
      kind: "cover_driver",
      id: cd.id,
      name: cd.name,
      role: "Cover Driver",
      homeStoreId: cd.store_id,
      isDriver: true,
      left: cd.is_active === false,
      rates: {
        cash: cashRate,
        ni: 0,
        bankLimit: 0,
        paidAnyCash: cashRate > 0,
        short: shortRate,
        long: longRate,
        shortMisc: shortRate,
        longMisc: longRate,
      },
      fixedDailyWage: null,
      days,
      bookings: bookingsFor(bookingsByPerson.get(`cd:${cd.id}`), dayIndex),
      totals: {
        worked: roundHoursToMinute(present.reduce((s, d) => s + d.workedHours, 0)),
        approved: roundHoursToMinute(present.reduce((s, d) => s + d.approvedHours, 0)),
        pendingHours: roundHoursToMinute(present.reduce((s, d) => s + d.pendingHours, 0)),
        pendingDrops,
        niHours: 0,
        cashHours: money.cashHours,
        niPay: 0,
        cashWage: money.cashWage,
        drops,
        payableDrops: money.payableDrops,
        deliveryWages: money.deliveryWages,
        cashDue: money.cashDue,
        daysWorked: present.filter((d) => d.clockIn).length,
        openDays: present.filter((d) => d.status === "open").length,
      },
      stores,
      storeIds,
      payoutMismatch: hasMismatch(stores),
    });
  }

  const KIND_ORDER: Record<StaffWeekPerson["kind"], number> = {
    manager: 0,
    employee: 1,
    cover_driver: 2,
  };
  return people.sort((a, b) =>
    a.kind !== b.kind ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.name.localeCompare(b.name),
  );
}
