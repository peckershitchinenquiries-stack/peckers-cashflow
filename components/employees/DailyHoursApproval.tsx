"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@/components/ui/icons";
import { addDays, cn, parseISODate, toISODate } from "@/lib/utils";
import type { ClockDailySummary, Store } from "@/lib/types";

const WD = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MO = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function longDate(iso: string): string {
  const d = parseISODate(iso);
  if (isNaN(d.getTime())) return iso;
  return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`;
}

function relLabel(iso: string, todayISO: string): string | null {
  if (iso === todayISO) return "Today";
  if (iso === toISODate(addDays(parseISODate(todayISO), -1))) return "Yesterday";
  return null;
}

const rowKey = (s: { employee_id: string; event_date: string }) =>
  `${s.employee_id}:${s.event_date}`;

type Handlers = {
  onApprove: (
    employee_id: string,
    event_date: string,
    override_hours?: number,
  ) => Promise<void>;
  onApproveDate: (event_date: string, employee_ids: string[]) => Promise<void>;
  onUnapprove: (employee_id: string, event_date: string) => Promise<void>;
};

export function DailyHoursApproval({
  summaries,
  stores,
  todayISO,
  showStore,
  onApprove,
  onApproveDate,
  onUnapprove,
}: {
  summaries: ClockDailySummary[];
  stores: Store[];
  todayISO: string;
  showStore: boolean;
} & Handlers) {
  const toast = useToast();
  const [selectedDate, setSelectedDate] = React.useState(todayISO);
  const [edited, setEdited] = React.useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [busyDate, setBusyDate] = React.useState<string | null>(null);
  const [hideApproved, setHideApproved] = React.useState(false);

  const storeName = React.useMemo(() => {
    const m = new Map(stores.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [stores]);

  // Manager-confirmed hours for a row: the edited value if valid, else the value
  // approved earlier, else the raw clocked total.
  function effHours(s: ClockDailySummary): number {
    const raw = edited[rowKey(s)];
    const parsed = raw !== undefined ? parseFloat(raw) : NaN;
    if (raw !== undefined && !isNaN(parsed) && parsed > 0) return parsed;
    if (s.approved_hours != null) return s.approved_hours;
    return s.clocked_hours;
  }

  const selectedRows = summaries.filter((s) => s.event_date === selectedDate);
  const approvedCount = selectedRows.filter((s) => s.hours_approved).length;
  const pendingCount = selectedRows.filter(
    (s) => !s.hours_approved && s.clocked_hours > 0,
  ).length;
  const visibleSelected = hideApproved
    ? selectedRows.filter((s) => !s.hours_approved)
    : selectedRows;

  // Every OTHER date that still has unapproved clocked days, newest first.
  const otherPendingByDate = React.useMemo(() => {
    const map = new Map<string, ClockDailySummary[]>();
    for (const s of summaries) {
      if (s.event_date === selectedDate) continue;
      if (s.hours_approved || s.clocked_hours <= 0) continue;
      const arr = map.get(s.event_date) ?? [];
      arr.push(s);
      map.set(s.event_date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [summaries, selectedDate]);

  const totalOtherPending = otherPendingByDate.reduce(
    (n, [, rows]) => n + rows.length,
    0,
  );

  function shiftDay(delta: number) {
    const next = toISODate(addDays(parseISODate(selectedDate), delta));
    if (delta > 0 && next > todayISO) return;
    setSelectedDate(next);
  }

  async function doApprove(s: ClockDailySummary) {
    const key = rowKey(s);
    const eff = effHours(s);
    if (!(eff > 0)) return;
    const override =
      Math.abs(eff - s.clocked_hours) > 0.01 ? eff : undefined;
    setBusyKey(key);
    try {
      await onApprove(s.employee_id, s.event_date, override);
      toast.success(`Approved ${s.employee_name} — ${eff.toFixed(2)}h`);
      setEdited((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusyKey(null);
    }
  }

  async function doUnapprove(s: ClockDailySummary) {
    const key = rowKey(s);
    setBusyKey(key);
    try {
      await onUnapprove(s.employee_id, s.event_date);
      toast.success(`Reverted ${s.employee_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function doApproveDate(date: string, rows: ClockDailySummary[]) {
    const ids = rows
      .filter((r) => !r.hours_approved && r.clocked_hours > 0)
      .map((r) => r.employee_id);
    if (ids.length === 0) return;
    setBusyDate(date);
    try {
      await onApproveDate(date, ids);
      toast.success(`Approved ${ids.length} employee${ids.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyDate(null);
    }
  }

  function Row({ s }: { s: ClockDailySummary }) {
    const key = rowKey(s);
    const busy = busyKey === key;
    const store = showStore ? storeName(s.store_id) : null;
    const adjusted =
      s.hours_approved &&
      s.approved_hours != null &&
      Math.abs(s.approved_hours - s.clocked_hours) > 0.01;

    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 py-3",
          s.hours_approved && "opacity-75",
        )}
      >
        <div className="flex-1 min-w-[8rem]">
          <p className="font-medium truncate">{s.employee_name}</p>
          <p className="text-xs text-text-muted">
            Clocked {s.clocked_hours.toFixed(2)}h
            {store && <> · {store}</>}
          </p>
        </div>

        {s.hours_approved ? (
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <CheckIcon size={12} />
              {(s.approved_hours ?? s.clocked_hours).toFixed(2)}h approved
            </Badge>
            {adjusted && (
              <span
                className="text-[11px] text-warning"
                title={`Adjusted from clocked ${s.clocked_hours.toFixed(2)}h`}
              >
                adj
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => doUnapprove(s)}
              loading={busy}
              className="text-text-muted hover:text-danger"
            >
              Undo
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={edited[key] ?? s.clocked_hours.toFixed(2)}
                onChange={(e) =>
                  setEdited((p) => ({ ...p, [key]: e.target.value }))
                }
                aria-label={`Hours for ${s.employee_name} on ${longDate(s.event_date)}`}
                className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/30"
              />
              <span className="text-xs text-text-muted">h</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => doApprove(s)}
              loading={busy}
              disabled={!(effHours(s) > 0)}
            >
              Approve
            </Button>
          </div>
        )}
      </div>
    );
  }

  const selRel = relLabel(selectedDate, todayISO);

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <DatePicker
            label="Approve day"
            value={selectedDate}
            onChange={(v) => setSelectedDate(v || todayISO)}
            max={todayISO}
            containerClassName="w-44"
          />
          <div className="flex items-center gap-1 pb-0.5">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => shiftDay(-1)}
              aria-label="Previous day"
            >
              <ChevronLeftIcon size={16} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => shiftDay(1)}
              disabled={selectedDate >= todayISO}
              aria-label="Next day"
            >
              <ChevronRightIcon size={16} />
            </Button>
            {selectedDate !== todayISO && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(todayISO)}
              >
                Today
              </Button>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-subtle cursor-pointer select-none pb-2">
          <input
            type="checkbox"
            checked={hideApproved}
            onChange={(e) => setHideApproved(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-gold"
          />
          Hide approved
        </label>
      </div>

      {/* Selected day */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {selRel ? `${selRel} · ` : ""}
              {longDate(selectedDate)}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {selectedRows.length === 0 ? (
                "No one clocked in"
              ) : pendingCount === 0 ? (
                <span className="text-success">All {approvedCount} approved ✓</span>
              ) : (
                <>
                  {approvedCount} approved · {pendingCount} pending
                </>
              )}
            </p>
          </div>
          {pendingCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => doApproveDate(selectedDate, selectedRows)}
              loading={busyDate === selectedDate}
              iconLeft={<CheckIcon size={16} />}
            >
              Approve all {pendingCount}
            </Button>
          )}
        </div>

        {selectedRows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ClockIcon />}
              title="No clocked hours"
              description="No completed clock-in/out sessions for this day. Try another date."
            />
          </div>
        ) : visibleSelected.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted text-center">
            All hours for this day are approved. Un-tick “Hide approved” to review them.
          </p>
        ) : (
          <div className="px-4 divide-y divide-border/60">
            {visibleSelected.map((s) => (
              <Row key={rowKey(s)} s={s} />
            ))}
          </div>
        )}
      </section>

      {/* Other dates still needing approval */}
      {otherPendingByDate.length > 0 && (
        <section className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-warning">
            <AlertIcon size={16} />
            <p className="text-sm font-medium">
              {totalOtherPending} clocked day
              {totalOtherPending === 1 ? "" : "s"} on{" "}
              {otherPendingByDate.length} other date
              {otherPendingByDate.length === 1 ? "" : "s"} still need approval
            </p>
          </div>

          {otherPendingByDate.map(([date, rows]) => {
            const rel = relLabel(date, todayISO);
            return (
              <div
                key={date}
                className="rounded-lg border border-border bg-surface"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className="text-sm font-medium text-text-primary hover:text-gold transition-colors"
                    title="Open this day"
                  >
                    {rel ? `${rel} · ` : ""}
                    {longDate(date)}{" "}
                    <span className="text-text-muted font-normal">
                      ({rows.length})
                    </span>
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => doApproveDate(date, rows)}
                    loading={busyDate === date}
                    iconLeft={<CheckIcon size={16} />}
                  >
                    Approve all {rows.length}
                  </Button>
                </div>
                <div className="px-3 divide-y divide-border/60">
                  {rows.map((s) => (
                    <Row key={rowKey(s)} s={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* How the daily total feeds payroll */}
      <p className="text-xs text-text-muted">
        Approving a day confirms its hours and rolls them into that employee’s
        weekly total. The <span className="font-medium text-text-primary">bank vs cash</span>{" "}
        split is worked out per week (first 20h = bank) — see the{" "}
        <span className="font-medium text-text-primary">Weekly Log</span> tab.
      </p>
    </div>
  );
}
