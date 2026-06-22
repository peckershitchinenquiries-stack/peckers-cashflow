// =============================================================
// Cash Flow Module — pure calculation helpers (PRG-CF-001).
//
// No server / Supabase imports — safe to use from client UI and server actions
// alike, so the live preview and the persisted payout sheet compute identically.
//
// Core rules (confirmed with the client):
//  - Cash wage uses the NI/bank split: the first `bank_weekly_hours_limit` hours
//    (default 20) of the week are NI/bank wages; only hours ABOVE that are paid
//    in cash, at the employee's hourly_cash_rate.
//  - Drivers are paid hourly like everyone else PLUS £2 per delivery (petrol).
//    Extra deliveries (logged with a reason) are paid the same £2.
//  - Wages paid on a Tuesday are for the PREVIOUS week's work (Mon–Sun);
//    the cash used to pay them is what this week's envelopes collected, plus a
//    default supermarket cash float.
//  - Opening balance carries forward last week's surplus.
// =============================================================

import type { DailyCashEntry, Employee, PrePaymentSummary, WageLine } from "./types";
import { hasRole } from "./types";
import { addDays, parseISODate, startOfISOWeek, toISODate } from "./utils";

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** £2 per delivery covers the driver's petrol; labour is paid hourly. */
export const DELIVERY_PETROL_RATE = 2;

/**
 * The pay week for a Tuesday payout: wages paid on this week's Tuesday are
 * for the PREVIOUS Monday–Sunday week.
 */
export function payWeekOf(weekStartISO: string): { start: string; end: string } {
  const start = toISODate(addDays(parseISODate(weekStartISO), -7));
  return { start, end: toISODate(addDays(parseISODate(start), 6)) };
}

/** Resolve a `?week=` param into the Monday-anchored week + prev/next links. */
export function resolveWeek(weekParam?: string | null): {
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
} {
  const base = weekParam ? parseISODate(weekParam) : new Date();
  const valid = isNaN(base.getTime()) ? new Date() : base;
  const weekStart = toISODate(startOfISOWeek(valid));
  const d = parseISODate(weekStart);
  return {
    weekStart,
    prevWeek: toISODate(addDays(d, -7)),
    nextWeek: toISODate(addDays(d, 7)),
  };
}

/** Split a week's worked hours into NI/bank vs cash-in-hand portions. */
export function splitHours(
  totalHours: number,
  bankLimit: number,
): { bankHours: number; cashHours: number } {
  const total = Math.max(0, Number(totalHours) || 0);
  const limit = Math.max(0, Number(bankLimit) || 0);
  const bankHours = Math.min(total, limit);
  const cashHours = Math.max(total - limit, 0);
  return { bankHours: round2(bankHours), cashHours: round2(cashHours) };
}

/**
 * Whether an employee is paid any hours in cash. An employee left with a blank
 * (or zero) cash rate doesn't work for cash at all — every hour is NI/PAYE,
 * regardless of how many hours they work in a week.
 */
export function worksForCash(emp: {
  hourly_cash_rate?: number | null;
}): boolean {
  return emp.hourly_cash_rate != null && Number(emp.hourly_cash_rate) > 0;
}

/**
 * Per-employee hours split. If the employee has no cash rate, ALL hours are
 * NI/bank hours (cash = 0) — even above the weekly bank limit. Otherwise the
 * usual "first `bank_weekly_hours_limit` hours NI, remainder cash" rule applies.
 */
export function splitHoursForEmployee(
  emp: { hourly_cash_rate?: number | null; bank_weekly_hours_limit?: number | null },
  totalHours: number,
): { bankHours: number; cashHours: number } {
  if (!worksForCash(emp)) {
    return { bankHours: round2(Math.max(0, Number(totalHours) || 0)), cashHours: 0 };
  }
  return splitHours(totalHours, emp.bank_weekly_hours_limit ?? 20);
}

// ---------------- daily reconciliation ----------------

export type WeekEntryTotals = {
  vitaMojoTotal: number;
  cashCollected: number;
  loggedDifferences: number;
  discrepancyDays: number;
};

/** Aggregate a week's daily cash entries for a single store. */
export function summariseWeekEntries(
  entries: Pick<DailyCashEntry, "vita_mojo_sales" | "envelope_amount" | "difference">[],
): WeekEntryTotals {
  let vita = 0;
  let envelope = 0;
  let discrepancyDays = 0;
  for (const e of entries) {
    vita += Number(e.vita_mojo_sales) || 0;
    envelope += Number(e.envelope_amount) || 0;
    const diff = Number(e.difference ?? (Number(e.vita_mojo_sales) - Number(e.envelope_amount)));
    if (Math.abs(diff) > 0.001) discrepancyDays += 1;
  }
  return {
    vitaMojoTotal: round2(vita),
    cashCollected: round2(envelope),
    // vita − envelopes; equals the sum of per-day differences.
    loggedDifferences: round2(vita - envelope),
    discrepancyDays,
  };
}

export type RunningBalanceRow = {
  entry_date: string;
  vita_mojo_sales: number;
  envelope_amount: number;
  difference: number;
  reason: string | null;
  is_late: boolean;
  running_balance: number;
  manager_name: string | null;
};

/**
 * Per-day cumulative running balance for a store's week. Physical cash on hand
 * = opening balance + Σ envelope amounts to date. Entries are sorted by date.
 */
export function runningBalanceRows(
  entries: DailyCashEntry[],
  openingBalance: number,
): RunningBalanceRow[] {
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  let balance = Number(openingBalance) || 0;
  return sorted.map((e) => {
    balance += Number(e.envelope_amount) || 0;
    return {
      entry_date: e.entry_date,
      vita_mojo_sales: Number(e.vita_mojo_sales) || 0,
      envelope_amount: Number(e.envelope_amount) || 0,
      difference: Number(e.difference) || 0,
      reason: e.reason,
      is_late: e.is_late,
      running_balance: round2(balance),
      manager_name: e.edited_by_name ?? e.submitted_by_name ?? null,
    };
  });
}

// ---------------- wages ----------------

export type WeekWorked = {
  /** Worked hours for the week (from clock records, else scheduled rota). */
  hours: number;
  /** Total deliveries completed in the week. */
  deliveries: number;
};

/**
 * Build the per-employee wage lines for a store's pay week.
 * `workedByEmployee` maps employee_id -> {hours, deliveries}. Employees whose
 * total payment is £0 (no cash hours and no deliveries) are omitted — the
 * payout sheet lists only those actually receiving cash.
 */
export function buildWageLines(
  employees: Employee[],
  workedByEmployee: Map<string, WeekWorked>,
): WageLine[] {
  const lines: WageLine[] = [];
  for (const emp of employees) {
    // Leavers are NOT skipped: wages are a week in arrears, so an employee who
    // left this week is still owed for the pay week. Anyone with nothing due is
    // dropped by the total<=0 check below.
    const worked = workedByEmployee.get(emp.id) ?? { hours: 0, deliveries: 0 };
    // No cash rate ⇒ no cash hours at all (every hour is NI), even past the
    // weekly bank limit. Otherwise hours above the limit are paid in cash.
    const { cashHours } = splitHoursForEmployee(emp, worked.hours);
    const cashRate = Number(emp.hourly_cash_rate ?? 0) || 0;
    const cashWage = round2(cashHours * cashRate);

    const isDriver = hasRole(emp.position, "Driver");
    const deliveries = isDriver ? Math.max(0, Math.round(worked.deliveries)) : 0;
    // £2/delivery petrol allowance unless a custom per-driver rate is set.
    const deliveryRate = isDriver
      ? emp.delivery_rate != null
        ? Number(emp.delivery_rate)
        : DELIVERY_PETROL_RATE
      : 0;
    const deliveryWages = round2(deliveries * deliveryRate);

    const total = round2(cashWage + deliveryWages);
    if (total <= 0) continue;

    lines.push({
      employee_id: emp.id,
      employee_name: emp.name,
      role: emp.position ?? null,
      cash_hours: cashHours,
      cash_rate: cashRate,
      cash_wage: cashWage,
      deliveries_count: deliveries,
      delivery_rate: deliveryRate,
      delivery_wages: deliveryWages,
      total_payment: total,
    });
  }
  return lines.sort((a, b) => b.total_payment - a.total_payment);
}

/** Assemble the full §3.4 pre-payment summary from its parts. */
export function buildPrePaymentSummary(input: {
  store_id: string;
  week_start_date: string;
  opening_balance: number;
  entries: Pick<DailyCashEntry, "vita_mojo_sales" | "envelope_amount" | "difference">[];
  lines: WageLine[];
  /** Default supermarket cash float added to the pot (0 if not configured). */
  supermarket_cash?: number;
}): PrePaymentSummary {
  const totals = summariseWeekEntries(input.entries);
  const opening = round2(input.opening_balance);
  const supermarketCash = round2(Math.max(0, Number(input.supermarket_cash) || 0));
  // Cash available to pay wages = carried-forward surplus + envelopes collected
  // + the default supermarket float. Wages are deducted from this; any remainder
  // is surplus, and a shortfall is the Post Office draw.
  const actualCashAvailable = round2(opening + totals.cashCollected + supermarketCash);
  const totalCashWages = round2(input.lines.reduce((s, l) => s + l.cash_wage, 0));
  const totalDeliveryWages = round2(input.lines.reduce((s, l) => s + l.delivery_wages, 0));
  const grandTotal = round2(totalCashWages + totalDeliveryWages);
  const diff = round2(actualCashAvailable - grandTotal);

  return {
    store_id: input.store_id,
    week_start_date: input.week_start_date,
    opening_balance: opening,
    vita_mojo_total: totals.vitaMojoTotal,
    cash_collected: totals.cashCollected,
    logged_differences: totals.loggedDifferences,
    supermarket_cash: supermarketCash,
    actual_cash_available: actualCashAvailable,
    total_cash_wages: totalCashWages,
    total_delivery_wages: totalDeliveryWages,
    grand_total_wages: grandTotal,
    post_office_draw: diff < 0 ? round2(-diff) : 0,
    surplus: diff > 0 ? diff : 0,
    lines: input.lines,
  };
}

// ---------------- aggregation from clock events ----------------

type ClockRow = {
  employee_id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  deliveries_count: number | null;
  /** Deliveries beyond the normal round — paid the same per-delivery rate. */
  extra_deliveries?: number | null;
};

type ShiftRow = {
  employee_id: string;
  is_day_off: boolean;
  scheduled_hours: number | null;
};

/**
 * Worked hours + deliveries per employee for a week. Hours come from completed
 * clock events; if an employee has no clock hours at all that week we fall back
 * to their scheduled rota hours so a payout can still be produced. Deliveries
 * always come from the clock events ("Deliveries – Live Count").
 */
export function aggregateWorked(
  clocks: ClockRow[],
  shifts: ShiftRow[],
): Map<string, WeekWorked> {
  const clockHours = new Map<string, number>();
  const deliveries = new Map<string, number>();
  for (const c of clocks) {
    const delivered = (Number(c.deliveries_count) || 0) + (Number(c.extra_deliveries) || 0);
    if (delivered > 0) {
      deliveries.set(c.employee_id, (deliveries.get(c.employee_id) ?? 0) + delivered);
    }
    if (c.clock_in_at && c.clock_out_at) {
      const ms = new Date(c.clock_out_at).getTime() - new Date(c.clock_in_at).getTime();
      if (ms > 0) {
        clockHours.set(c.employee_id, (clockHours.get(c.employee_id) ?? 0) + ms / 3_600_000);
      }
    }
  }

  const scheduledHours = new Map<string, number>();
  for (const s of shifts) {
    if (s.is_day_off) continue;
    scheduledHours.set(
      s.employee_id,
      (scheduledHours.get(s.employee_id) ?? 0) + (Number(s.scheduled_hours) || 0),
    );
  }

  const result = new Map<string, WeekWorked>();
  const ids = new Set<string>([
    ...Array.from(clockHours.keys()),
    ...Array.from(deliveries.keys()),
    ...Array.from(scheduledHours.keys()),
  ]);
  for (const id of Array.from(ids)) {
    const hours = clockHours.has(id) ? clockHours.get(id)! : scheduledHours.get(id) ?? 0;
    result.set(id, {
      hours: round2(hours),
      deliveries: deliveries.get(id) ?? 0,
    });
  }
  return result;
}
