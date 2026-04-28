// =============================================================
// Utility helpers: dates, currency, week handling, classnames
// =============================================================

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ---------------- currency ----------------
export function formatINR(value: number | null | undefined, opts?: { compact?: boolean }) {
  const n = Number(value ?? 0);
  if (opts?.compact && Math.abs(n) >= 100000) {
    return "₹" + new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(n);
  }
  return "₹" + new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatINRPlain(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ---------------- date ----------------
export function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Parses YYYY-MM-DD or ISO timestamp into a local Date (no timezone shift). */
export function parseISODate(s: string): Date {
  if (!s) return new Date(NaN);
  // If pure date YYYY-MM-DD -> construct in local timezone to avoid UTC offset issues.
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
