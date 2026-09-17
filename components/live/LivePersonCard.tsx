"use client";

import * as React from "react";
import { formatGBP, formatTimeOnly } from "@/lib/utils";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { LiveDashboardStatus } from "@/lib/types";

/** Compact "3h 05m" — the card is only a phone wide, so "3 hr 5 min" won't fit. */
function hm(hours: number): string {
  const total = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Card tint, bar colour and pill per status, so the board reads at a glance. */
const TONE: Record<LiveDashboardStatus, { card: string; bar: string; pill: string }> = {
  on_shift: {
    card: "border-success/35 bg-success/[0.06]",
    bar: "bg-success",
    pill: "bg-success/15 text-success border-success/40",
  },
  expected: {
    card: "border-warning/30 bg-warning/[0.05]",
    bar: "bg-warning/70",
    pill: "bg-warning/15 text-warning border-warning/40",
  },
  late: {
    card: "border-warning/50 bg-warning/[0.1]",
    bar: "bg-warning",
    pill: "bg-warning/30 text-warning border-warning/60",
  },
  clocked_out: {
    card: "border-border bg-surface",
    bar: "bg-text-subtle/60",
    pill: "bg-surface-hover text-text-subtle border-border",
  },
  day_off: {
    card: "border-danger/25 bg-danger/[0.04]",
    bar: "bg-danger/40",
    pill: "bg-danger/10 text-danger border-danger/30",
  },
  on_leave: {
    card: "border-warning/25 bg-warning/[0.04]",
    bar: "bg-warning/50",
    pill: "bg-warning/10 text-warning border-warning/30",
  },
  tbc: {
    card: "border-border bg-surface",
    bar: "bg-text-muted/40",
    pill: "bg-surface-hover text-text-muted border-border",
  },
  absent: {
    card: "border-danger/50 bg-danger/[0.1]",
    bar: "bg-danger",
    pill: "bg-danger/20 text-danger border-danger/60",
  },
};

type Props = {
  name: string;
  role: string;
  status: LiveDashboardStatus;
  statusLabel: string;
  /** Booked window, already formatted ("17:00–23:00" / "Day Off"). */
  shiftLabel: string;
  /** "default" / "usual" — the window came from a template, not a booking. */
  shiftNote?: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  /** Hours booked for today; 0 when nothing is scheduled. */
  expectedHours: number;
  /** Hours clocked so far today (an open shift counted up to now). */
  workedHours: number;
  expectedWage: number;
  actualWage: number;
  /** Null for anyone who doesn't drive — the cell is dropped, not dashed. */
  deliveries: number | null;
  /** More than one shift today; the label lists the windows. */
  shiftCount?: number;
  shiftsLabel?: string;
  manualEntry?: boolean;
  manualReason?: string | null;
};

function Stat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0 px-2 py-1.5 text-center" title={title}>
      <div className="text-[9px] uppercase tracking-wider text-text-muted">{label}</div>
      <div
        className={
          "text-[13px] font-semibold tabular-nums truncate " +
          (tone ?? "text-text-primary")
        }
      >
        {value}
      </div>
    </div>
  );
}

export function LivePersonCard({
  name,
  role,
  status,
  statusLabel,
  shiftLabel,
  shiftNote,
  clockInAt,
  clockOutAt,
  expectedHours,
  workedHours,
  expectedWage,
  actualWage,
  deliveries,
  shiftCount = 0,
  shiftsLabel,
  manualEntry,
  manualReason,
}: Props) {
  // Collapsed by default so a full board stays short; tap to see the detail.
  const [expanded, setExpanded] = React.useState(false);
  const tone = TONE[status];
  const off = status === "day_off" || status === "on_leave";
  const clocked = clockInAt != null;
  const pct =
    expectedHours > 0
      ? Math.min(100, (workedHours / expectedHours) * 100)
      : workedHours > 0
        ? 100
        : 0;

  const progressText =
    workedHours > 0
      ? expectedHours > 0
        ? `${hm(workedHours)} of ${hm(expectedHours)}`
        : `${hm(workedHours)} worked`
      : expectedHours > 0
        ? `${hm(expectedHours)} booked`
        : "No shift booked";

  const footnote = off
    ? "Not working today"
    : !clocked
      ? expectedWage > 0
        ? `Not clocked in · ${formatGBP(expectedWage)} expected`
        : "Not clocked in"
      : expectedWage > 0
        ? `Expected pay ${formatGBP(expectedWage)}`
        : "";

  return (
    <div className={"rounded-xl border p-2.5 " + tone.card}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-start justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-text-primary leading-tight truncate">
            {name}
          </div>
          <div className="text-[11px] text-text-muted truncate">
            {expanded || off ? role : `${shiftLabel} · ${progressText}`}
          </div>
        </div>
        <span className="shrink-0 flex items-center gap-1.5">
          <span
            className={
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border " +
              tone.pill
            }
          >
            {statusLabel}
          </span>
          <ChevronRightIcon
            size={14}
            className={"text-text-muted transition-transform " + (expanded ? "rotate-90" : "")}
          />
        </span>
      </button>

      {expanded && (
      <>
      {!off && (
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-semibold tabular-nums text-text-subtle">
              {shiftLabel}
              {shiftNote && (
                <span className="ml-1 text-[9px] uppercase tracking-wide font-normal text-text-muted">
                  {shiftNote}
                </span>
              )}
            </span>
            <span className="text-text-muted tabular-nums">{progressText}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className={"h-full rounded-full transition-all " + tone.bar}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* The stat rail only earns its space once something is clocked — for
          someone still expected it would be a row of dashes. */}
      {!off && clocked && (
        <div
          className={
            "mt-2.5 grid divide-x divide-border rounded-lg border border-border bg-surface " +
            (deliveries == null ? "grid-cols-3" : "grid-cols-4")
          }
        >
          <Stat
            label="In"
            value={
              <>
                {formatTimeOnly(clockInAt)}
                {shiftCount > 1 && <span className="ml-0.5 text-gold">×{shiftCount}</span>}
              </>
            }
            title={shiftCount > 1 ? shiftsLabel : undefined}
          />
          <Stat label="Out" value={formatTimeOnly(clockOutAt)} />
          <Stat
            label="Pay so far"
            value={actualWage > 0 ? formatGBP(actualWage) : "—"}
            tone={actualWage > 0 ? "text-gold" : "text-text-muted"}
            title={expectedWage > 0 ? `${formatGBP(expectedWage)} expected today` : undefined}
          />
          {deliveries != null && (
            <Stat
              label="Drops"
              value={deliveries}
              tone={deliveries > 0 ? "text-text-primary" : "text-text-muted"}
            />
          )}
        </div>
      )}

      {(footnote || manualEntry) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-text-muted">
          <span className="tabular-nums">{footnote}</span>
          {manualEntry && (
            <span
              className="uppercase tracking-wide text-warning font-medium shrink-0"
              title={
                manualReason
                  ? `Entered by a manager — ${manualReason}`
                  : "Entered by a manager (no location check)"
              }
            >
              manual entry
            </span>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
