// =============================================================
// UK minimum-wage compliance helpers. PURE (no imports beyond types) so it can
// run in the alert scanner, server pages, and client UI alike.
//
// We compare an employee's on-the-books rate (hourly_ni_rate, falling back to
// hourly_rate) against the legal minimum for their age band. This is a WARNING
// signal only — it never blocks saving.
// =============================================================

import type { MinWageBands } from "./settings";

/** Whole-years age from a YYYY-MM-DD date of birth, as of `asOf` (default now). */
export function ageFromDOB(
  dobISO: string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (!dobISO) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dobISO);
  if (!m) return null;
  const dob = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(dob.getTime())) return null;
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
}

/** Legal minimum hourly rate for an age, per the configured bands. */
export function minWageForAge(
  age: number | null,
  bands: MinWageBands,
): number | null {
  if (age == null) return null;
  if (age >= 21) return bands.nlw_21_plus;
  if (age >= 18) return bands.age_18_20;
  return bands.under_18;
}

export type WageCompliance = {
  age: number;
  rate: number;
  required: number;
  compliant: boolean;
  /** required - rate; positive means underpaid by this much per hour. */
  shortfall: number;
};

/**
 * Assess an employee against the bands. Returns null when it can't be assessed
 * (checking disabled, no DOB, or no rate set).
 */
export function wageComplianceForEmployee(
  emp: {
    date_of_birth: string | null;
    hourly_ni_rate: number | null;
    hourly_rate: number;
  },
  bands: MinWageBands,
  asOf?: Date,
): WageCompliance | null {
  if (!bands.enabled) return null;
  const age = ageFromDOB(emp.date_of_birth, asOf);
  if (age == null) return null;
  const required = minWageForAge(age, bands);
  if (required == null) return null;
  const rate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);
  if (!rate) return null;
  const shortfall = Math.round((required - rate) * 100) / 100;
  return { age, rate, required, compliant: shortfall <= 0, shortfall };
}
