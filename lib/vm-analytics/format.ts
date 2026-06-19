// Coerce the numeric-or-string values Supabase returns (numeric columns come
// back as strings over the REST API) into real numbers.
export function n(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
}

const gbpFmt = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

const gbp0Fmt = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const intFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function gbp(v: unknown): string {
  return gbpFmt.format(n(v));
}

export function gbp0(v: unknown): string {
  return gbp0Fmt.format(n(v));
}

export function int(v: unknown): string {
  return intFmt.format(Math.round(n(v)));
}

// Truncate (NOT round) a number toward zero to `digits` decimals. These figures
// drive business decisions, so a value like 15.1182% must show as 15.11%, never
// rounded up to 15.12%. Done via a fixed-string slice (rounded a few places
// deeper first) so binary float noise — e.g. 0.29 held as 0.289999… — can't
// truncate to the wrong penny.
export function truncTo(v: number, digits: number): number {
  if (!Number.isFinite(v)) return 0;
  const neg = v < 0;
  const s = Math.abs(v).toFixed(digits + 4); // clears float noise at the tail
  const dot = s.indexOf(".");
  const cut = digits > 0 ? s.slice(0, dot + 1 + digits) : s.slice(0, dot);
  const num = Number(cut);
  return neg ? -num : num;
}

// Percentages are TRUNCATED to 2 decimals everywhere so they reconcile across
// dashboards and never round up. (Money stays at the penny — see gbp.)
export function pct(v: unknown, digits = 2): string {
  return `${truncTo(n(v), digits).toFixed(digits)}%`;
}

// Signed percentage with +/- prefix, for WoW deltas. Returns "—" when null.
export function signedPct(v: unknown, digits = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  const num = truncTo(n(v), digits);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(digits)}%`;
}

// Tailwind text colour for a delta (green up / red down / grey flat).
export function deltaClass(v: unknown): string {
  if (v === null || v === undefined || v === "") return "text-ink-faint";
  const num = n(v);
  if (num > 0.05) return "text-emerald-600";
  if (num < -0.05) return "text-rose-600";
  return "text-ink-faint";
}

// "1 Jun – 7 Jun 2026" style range from ISO dates.
export function weekRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return "—";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const start = new Date(startIso + "T00:00:00Z");
  const startStr = start.toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
  if (!endIso) return startStr;
  const end = new Date(endIso + "T00:00:00Z");
  const endStr = end.toLocaleDateString("en-GB", {
    ...opts,
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startStr} – ${endStr}`;
}
