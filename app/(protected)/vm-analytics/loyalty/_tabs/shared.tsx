import type { ReactNode } from "react";
import { n, truncTo } from "@/lib/vm-analytics/format";
import type { LoyaltyOrderProfileRow } from "@/lib/vm-analytics/types";

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-secondary">
      {children}
    </div>
  );
}

export function Caveat({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs text-tertiary">{children}</p>;
}

export function InsightsMissing() {
  return (
    <Note>
      This section needs the loyalty insight views. Run{" "}
      <code className="font-mono text-xs">docs/sql/vm_loyalty_insights.sql</code> in the VM Supabase project, then{" "}
      <code className="font-mono text-xs">select vm_refresh_loyalty_snapshots();</code> once. The weekly loyalty sync
      keeps them up to date after that.
    </Note>
  );
}

export function shortWeek(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function wow(cur: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

// A change in a share is shown in percentage points, never as a % of a %.
export function pointsDelta(cur: number | null, prev: number | null): string | null {
  if (cur === null || prev === null) return null;
  const d = truncTo(cur - prev, 1);
  return `${d > 0 ? "+" : ""}${d.toFixed(1)} pts vs last week`;
}

// 0–100, or null when there is nothing to divide by.
export function share(part: unknown, whole: unknown): number | null {
  const w = n(whole);
  return w > 0 ? (100 * n(part)) / w : null;
}

// Snapshots can't be backfilled: the selected week's, else the nearest earlier, else the first.
export function pickSnapshot<T extends { week_start_iso: string }>(rows: T[], week: string): T | null {
  return (
    rows.find((r) => r.week_start_iso === week) ??
    [...rows].reverse().find((r) => r.week_start_iso <= week) ??
    rows[0] ??
    null
  );
}

export function ShareBar({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
      <div className="h-full rounded-full bg-gold" style={{ width: `${width}%` }} />
    </div>
  );
}

export interface MemberSplit {
  bucket: string;
  rank: number;
  member: number;
  nonMember: number;
}

// Sums order-profile rows over the weeks fetched, one line per bucket.
export function splitByBucket(rows: LoyaltyOrderProfileRow[]): MemberSplit[] {
  const byBucket = new Map<string, MemberSplit>();
  for (const r of rows) {
    const line = byBucket.get(r.bucket) ?? { bucket: r.bucket, rank: n(r.bucket_rank), member: 0, nonMember: 0 };
    if (r.is_member) line.member += n(r.orders);
    else line.nonMember += n(r.orders);
    byBucket.set(r.bucket, line);
  }
  return [...byBucket.values()].sort((a, b) => a.rank - b.rank || a.bucket.localeCompare(b.bucket));
}

// Chart values: truncated like pct(), never rounded up.
export function chartPct(v: number | null): number {
  return v === null ? 0 : truncTo(v, 1);
}
