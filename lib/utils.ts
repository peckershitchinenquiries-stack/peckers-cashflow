// =============================================================
// Utility helpers: dates, currency, week handling, classnames
// =============================================================

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ---------------- currency ----------------
/** Format a value as GBP (£) with 2 decimals. */
export function formatGBP(value: number | null | undefined, opts?: { compact?: boolean }) {
  const n = Number(value ?? 0);
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(n);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Alias kept for backwards-compat with cash-flow pages. */
export const formatINR = formatGBP;

export function formatGBPPlain(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export const formatINRPlain = formatGBPPlain;

// ---------------- date ----------------
export function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Parses YYYY-MM-DD or ISO timestamp into a local Date (no timezone shift). */
export function parseISODate(s: string): Date {
  if (!s) return new Date(NaN);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

/** Format a Date or YYYY-MM-DD string as dd/mm/yyyy. */
export function formatDDMMYYYY(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseISODate(d) : d;
  if (isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Format a Date as ISO YYYY-MM-DD using local timezone. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Monday of the week containing d (week starts Monday). */
export function startOfISOWeek(d: Date) {
  const date = startOfDay(d);
  const dow = date.getDay(); // 0 sun .. 6 sat
  const diff = (dow + 6) % 7; // mon=0, sun=6
  return addDays(date, -diff);
}

export function endOfISOWeek(d: Date) {
  return addDays(startOfISOWeek(d), 6);
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function eachDay(start: Date, end: Date) {
  const out: Date[] = [];
  let cur = startOfDay(start);
  const last = startOfDay(end);
  while (cur.getTime() <= last.getTime()) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(d: Date) {
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekLabel(weekStart: Date) {
  const end = endOfISOWeek(weekStart);
  return `${formatDDMMYYYY(weekStart)} – ${formatDDMMYYYY(end)}`;
}

/** Weekday index (0=Mon, 6=Sun) for a date. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Resolve the rota's visible date range from optional `start`/`end` query
 * params. Defaults to the current ISO week (Mon–Sun) when params are missing
 * or invalid, guarantees start ≤ end, and caps the span to one year so a
 * stray URL can't trigger an enormous query.
 */
export function resolveRotaRange(
  startParam?: string | string[],
  endParam?: string | string[],
): { startIso: string; endIso: string } {
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const isISO = (s?: string) =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISODate(s).getTime());

  const sp = pick(startParam);
  const ep = pick(endParam);
  const weekStart = startOfISOWeek(new Date());

  let start = isISO(sp) ? parseISODate(sp!) : weekStart;
  let end = isISO(ep) ? parseISODate(ep!) : addDays(start, 6);

  if (end.getTime() < start.getTime()) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  // Cap span at 366 days.
  if (end.getTime() - start.getTime() > 366 * 86_400_000) {
    end = addDays(start, 366);
  }
  return { startIso: toISODate(start), endIso: toISODate(end) };
}

// ---------------- time / shift helpers ----------------
/** Convert HH:MM (24h) string to minutes since midnight. */
export function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + min;
}

/** Format minutes back to HH:MM. */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}

/** Hours between start & end HH:MM strings (handles overnight). */
export function shiftHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  let s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e < s) e += 24 * 60;
  return Math.max(0, (e - s) / 60);
}

/** Format start/end as "HH:MM – HH:MM" or "Day Off". */
export function formatShiftRange(
  isDayOff: boolean,
  start: string | null,
  end: string | null,
): string {
  if (isDayOff) return "Day Off";
  if (!start || !end) return "—";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/** Format a timestamptz to HH:MM (local). */
export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------- geofencing ----------------
/** Haversine distance in metres between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Max GPS-accuracy slack (metres) we forgive when deciding if someone is
 * "in range". Phone GPS is typically accurate to 5–65m; this lets a reading at
 * the door pass even if the fix is a little fuzzy, while still rejecting the
 * wildly-inaccurate Wi-Fi/IP fixes laptops report (often 500–3000m).
 */
export const GEOFENCE_ACCURACY_TOLERANCE_M = 100;

/**
 * Is a reported position within a store's geofence?
 * `distance` and `radius` are metres; `accuracy` is the GPS reading's ±metres.
 * We treat the person as in-range if they could plausibly be inside the radius
 * once GPS slop (capped) is accounted for. Shared by the client UI and the
 * server action so both agree on the verdict.
 */
export function isWithinGeofence(
  distanceM: number,
  radiusM: number,
  accuracyM?: number | null,
): boolean {
  const slack = Math.min(
    Math.max(0, Number(accuracyM ?? 0)),
    GEOFENCE_ACCURACY_TOLERANCE_M,
  );
  return distanceM <= radiusM + slack;
}

/**
 * Group an array of clock_events into per-employee per-week totals.
 * employeeMap keys are employee id, values carry name + rates for wage calc.
 */
export function groupClockEventsByWeek(
  clockEvents: Array<{
    employee_id: string;
    event_date: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
  }>,
  employeeMap: Map<
    string,
    { name: string; hourly_ni_rate: number | null; hourly_rate: number }
  >,
): Array<{
  employee_id: string;
  employee_name: string;
  week_start_date: string;
  total_hours: number;
  event_count: number;
  hourly_ni_rate: number | null;
  hourly_rate: number;
}> {
  const byKey = new Map<string, { hours: number; count: number }>();

  for (const ce of clockEvents) {
    if (!ce.clock_in_at || !ce.clock_out_at) continue;
    const weekStart = toISODate(startOfISOWeek(parseISODate(ce.event_date)));
    const key = `${ce.employee_id}:${weekStart}`;
    const ms =
      new Date(ce.clock_out_at).getTime() - new Date(ce.clock_in_at).getTime();
    const prev = byKey.get(key) ?? { hours: 0, count: 0 };
    byKey.set(key, { hours: prev.hours + ms / 3_600_000, count: prev.count + 1 });
  }

  return Array.from(byKey.entries())
    .map(([key, data]) => {
      const sepIdx = key.indexOf(":");
      const empId = key.slice(0, sepIdx);
      const weekStart = key.slice(sepIdx + 1);
      const emp = employeeMap.get(empId);
      return {
        employee_id: empId,
        employee_name: emp?.name ?? "—",
        week_start_date: weekStart,
        total_hours: Math.round(data.hours * 100) / 100,
        event_count: data.count,
        hourly_ni_rate: emp?.hourly_ni_rate ?? null,
        hourly_rate: emp?.hourly_rate ?? 0,
      };
    })
    .sort((a, b) => b.week_start_date.localeCompare(a.week_start_date));
}

// ---------------- numbers / safety ----------------
export function clampNumber(n: unknown, fallback = 0) {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  if (typeof v !== "number" || isNaN(v)) return fallback;
  return v;
}

export function safeDivide(a: number, b: number) {
  if (!b) return 0;
  return a / b;
}

/** Percent difference between a and baseline (0 if baseline is 0). */
export function percentDelta(a: number, baseline: number): number {
  if (!baseline) return 0;
  return ((a - baseline) / baseline) * 100;
}

// ---------------- CSV ----------------
export function toCSV(headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
