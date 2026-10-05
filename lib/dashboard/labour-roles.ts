// =============================================================
// Labour split by WHAT the money bought — kitchen production vs getting food
// out the door — rather than by how the person was paid.
//
// The classifier is `employees.position`, which is a FACT: a Driver's hours are
// delivery cost whether they did 90 drops or 8, because the waiting between
// drops is what the store was paying for. 16 of 18 employees carry a single
// unambiguous position, so for almost everyone there is nothing to estimate.
//
// Only a DUAL-ROLE person ("Kitchen Team Member|Driver"), or a line with no
// employee record behind it, needs estimating — nothing records how much of
// their shift was spent driving. For those, delivery time is inferred from the
// people who do nothing but deliver: cover drivers' hours / drops gives an
// observed hours-per-drop for that store-week, spent against the person's drops.
//
// Pure. No I/O, no queries — the caller supplies the positions. Deliberately
// separate from `labourCompositionFromLines`, which the VM Analytics labour-cost
// page reads and which keeps its pay-shaped cut.
// =============================================================

import { labourLineTotals, round2, type WeeklyReportLabourLine } from "@/lib/weekly-report";
import { parsePositions } from "@/lib/types";

/**
 * Clamp on the calibrated hours-per-drop. Load-bearing: a quiet week with 2
 * drops in 8 cover-driver hours would otherwise read as "4 hours per delivery"
 * and silently move thousands of pounds from Kitchen to Delivery.
 */
export const MIN_HOURS_PER_DELIVERY = 0.133; // 8 min
export const MAX_HOURS_PER_DELIVERY = 0.667; // 40 min
/** Used when the week has no cover driver hours to calibrate from. */
export const DEFAULT_HOURS_PER_DELIVERY = 0.333; // 20 min

/** `employees.position` by employee id, for the people on the week's lines. */
export type PositionsById = ReadonlyMap<string, string | null>;

export type LabourRoleSplit = {
  /** Manager hourly pay — their fixed daily wage plus any cash hours. No drops. */
  managers: number;
  /** Hourly pay for the share of employee time that was not delivery. */
  kitchen: number;
  /**
   * Everything that got food out the door: drivers' hourly pay, the estimated
   * delivery share of a dual-role person's pay, every drop allowance whoever
   * earned it, and cover drivers' hourly pay.
   */
  delivery: number;
  /** Ad-hoc outsourced cover, belonging to none of the above. 0 when there is none. */
  outsourced: number;
  /** The rate applied to dual-role lines, after clamping — reported so it is auditable. */
  hoursPerDelivery: number;
  /** False when no cover driver hours existed and the default was used instead. */
  calibrated: boolean;
  /**
   * How much of `kitchen` + `delivery` rests on the estimate rather than on a
   * position. 0 means the whole split is fact — nobody dual-role worked.
   */
  estimatedPay: number;
};

type Role = "driver" | "kitchen" | "both";

/**
 * A line's role from its employee's position. Unknown — no employee record, no
 * position, or a value POSITION_OPTIONS doesn't recognise — is treated as
 * "both" so it falls to the estimate rather than being asserted either way.
 */
export function roleOf(positionStr: string | null | undefined): Role {
  const positions = parsePositions(positionStr ?? null);
  const driver = positions.includes("Driver");
  const kitchen = positions.some((p) => p !== "Driver");
  if (driver && !kitchen) return "driver";
  if (kitchen && !driver) return "kitchen";
  return "both";
}

/**
 * Observed hours per drop for the week, from cover driver lines only — they do
 * nothing but deliver, so their rate is the one honest measurement available.
 *
 * It is an UPPER BOUND on a dual-role person's driving time: a dedicated
 * driver's hours include waiting between drops that a kitchen member spends
 * cooking.
 */
export function calibrateHoursPerDelivery(lines: WeeklyReportLabourLine[]): {
  rate: number;
  calibrated: boolean;
} {
  let hours = 0;
  let drops = 0;
  for (const l of lines) {
    if (l.source !== "cover_driver") continue;
    hours += labourLineTotals(l).hours;
    drops += l.deliveries ?? 0;
  }
  if (hours <= 0 || drops <= 0) return { rate: DEFAULT_HOURS_PER_DELIVERY, calibrated: false };
  const raw = hours / drops;
  return {
    rate: Math.min(MAX_HOURS_PER_DELIVERY, Math.max(MIN_HOURS_PER_DELIVERY, raw)),
    calibrated: true,
  };
}

export function labourRoleSplitFromLines(
  lines: WeeklyReportLabourLine[],
  positions: PositionsById = new Map(),
): LabourRoleSplit {
  const { rate, calibrated } = calibrateHoursPerDelivery(lines);

  let managers = 0;
  let outsourced = 0;
  let kitchen = 0;
  let estimated = 0;
  // Employee hourly pay plus every other certain delivery cost, kept together
  // so Kitchen + Delivery can be made to sum to it exactly below.
  let hourlyAndDelivery = 0;

  for (const l of lines) {
    const t = labourLineTotals(l);
    if (l.source === "manager") {
      managers += t.ni_total + t.cash_total;
      hourlyAndDelivery += t.delivery_pay;
      continue;
    }
    if (l.source === "cover_driver") {
      hourlyAndDelivery += t.ni_total + t.cash_total + t.delivery_pay;
      continue;
    }
    if (l.source === "adhoc") {
      outsourced += t.ni_total + t.cash_total + t.delivery_pay;
      continue;
    }

    const hourlyPay = t.ni_total + t.cash_total;
    const role = roleOf(l.employee_id ? positions.get(l.employee_id) : null);
    if (role === "kitchen") {
      kitchen += hourlyPay;
    } else if (role === "both") {
      const drops = l.deliveries ?? 0;
      // The cap stops an over-stated rate billing more delivery hours than the
      // person actually worked.
      const fohHours = Math.min(drops * rate, t.hours);
      const fohShare = t.hours > 0 ? fohHours / t.hours : drops > 0 ? 1 : 0;
      // Applied to the COMBINED hourly pay, proportionally across NI and cash:
      // the NI/cash split is a weekly 20-hour threshold rule and says nothing
      // about what the person was doing.
      kitchen += hourlyPay * (1 - fohShare);
      estimated += hourlyPay;
    }
    // role === "driver" adds nothing to kitchen: all of it is delivery.
    hourlyAndDelivery += hourlyPay + t.delivery_pay;
  }

  const kitchenRounded = round2(kitchen);
  return {
    managers: round2(managers),
    kitchen: kitchenRounded,
    // Derived by subtraction so Kitchen and Delivery always sum to the penny.
    delivery: round2(round2(hourlyAndDelivery) - kitchenRounded),
    outsourced: round2(outsourced),
    hoursPerDelivery: round2(rate),
    calibrated,
    estimatedPay: round2(estimated),
  };
}
