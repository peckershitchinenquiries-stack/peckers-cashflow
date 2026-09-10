"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { HoursMinsDisplay } from "@/components/ui/HoursMinsDisplay";
import {
  AlertIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
} from "@/components/ui/icons";
import { loadStaffWeek, type StaffWeek } from "@/app/actions/staff-week";
import type {
  Drops,
  StaffWeekBooking,
  StaffWeekDay,
  StaffWeekDayStatus,
  StaffWeekPerson,
} from "@/lib/staff-week";
import {
  MONTH_SHORT,
  WEEKDAY_SHORT,
  addDays,
  cn,
  formatDDMMYYYY,
  formatGBP,
  londonHHMM,
  parseISODate,
  startOfISOWeek,
  toISODate,
} from "@/lib/utils";
import { downloadXlsx, type XlsxColumn } from "@/lib/xlsx";

type Kind = "all" | "employee" | "cover_driver" | "manager";

/**
 * Held by EmployeesView, which outlives this tab, so a revisit shows what was
 * already loaded. `weeks` must be emptied by any write that can move a figure.
 */
export type StaffWeekCache = {
  /** Store the weeks were loaded as — a manager's store switch voids them. */
  scope: string | null;
  week: string | null;
  kind: Kind;
  weeks: Record<string, StaffWeek>;
};

export function emptyStaffWeekCache(scope: string | null): StaffWeekCache {
  return { scope, week: null, kind: "all", weeks: {} };
}

type BadgeVariant = "neutral" | "success" | "danger" | "warning" | "gold";

const STATUS: Record<StaffWeekDayStatus, { label: string; badge: BadgeVariant }> = {
  approved: { label: "Approved", badge: "success" },
  pending: { label: "Pending", badge: "warning" },
  partial: { label: "Part approved", badge: "gold" },
  open: { label: "On shift", badge: "neutral" },
  "no-drops": { label: "No drops", badge: "neutral" },
};

const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "employee", label: "Employees" },
  { id: "cover_driver", label: "Cover Drivers" },
  { id: "manager", label: "Managers" },
];

const KIND_LABEL: Record<StaffWeekPerson["kind"], string> = {
  employee: "Employee",
  manager: "Manager",
  cover_driver: "Cover driver",
};

function mondayOf(iso: string): string {
  return toISODate(startOfISOWeek(parseISODate(iso)));
}

function shiftWeek(iso: string, weeks: number): string {
  return toISODate(addDays(parseISODate(iso), weeks * 7));
}

function hhmm(iso: string | null): string {
  return iso ? londonHHMM(new Date(iso)) : "—";
}

/** Compact hours for dense cells: "7h", "7h 05m". */
function shortHours(h: number): string {
  const total = Math.round((Number(h) || 0) * 60);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hrs}h ${String(mins).padStart(2, "0")}m` : `${hrs}h`;
}

function weekdayOf(iso: string): string {
  return WEEKDAY_SHORT[(parseISODate(iso).getDay() + 6) % 7];
}

function longDate(iso: string): string {
  const d = parseISODate(iso);
  return `${weekdayOf(iso)} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDate(iso: string): string {
  return `${weekdayOf(iso)} ${formatDDMMYYYY(iso).slice(0, 5)}`;
}

const totalDrops = (d: Drops) => d.sd + d.ld + d.sm + d.lm;

function dropsLabel(d: Drops): string {
  const parts: string[] = [];
  if (d.sd) parts.push(`${d.sd} SD`);
  if (d.ld) parts.push(`${d.ld} LD`);
  if (d.sm) parts.push(`${d.sm} SM`);
  if (d.lm) parts.push(`${d.lm} LM`);
  return parts.length ? parts.join(" / ") : "—";
}

function dayWindow(day: StaffWeekDay): string {
  if (!day.clockIn) {
    return day.shifts.some((s) => s.approvedWithoutClock) ? "No clock record" : "Drops only";
  }
  return `${hhmm(day.clockIn)}–${day.clockOut ? hhmm(day.clockOut) : "now"}`;
}

/** Hours shown for a day: clocked, or approved when there's no clock behind it. */
function dayHoursLabel(day: StaffWeekDay): string {
  if (day.clockIn) return shortHours(day.workedHours);
  return day.approvedHours > 0 ? shortHours(day.approvedHours) : dropsLabel(day.drops);
}

type NoClock = { label: string; detail: string | null; missed: boolean };

/**
 * A day with no clock record, read against the rota: a booked shift in the past
 * that nobody clocked is flagged, a booking still to come is shown as booked,
 * an "On Leave" cell reads as leave, and everything else — a "Day Off" cell or
 * nothing booked — is a day off.
 */
function noClockDay(
  booking: StaffWeekBooking | null,
  date: string,
  todayISO: string,
): NoClock {
  if (booking?.dayOff && booking.onLeave) return { label: "On Leave", detail: null, missed: false };
  if (!booking || booking.dayOff) return { label: "Day Off", detail: null, missed: false };
  const times =
    booking.start && booking.end
      ? `${booking.start.slice(0, 5)}–${booking.end.slice(0, 5)}`
      : null;
  return date < todayISO
    ? { label: "Not clocked", detail: times ? `booked ${times}` : "booked", missed: true }
    : { label: "Booked", detail: times, missed: false };
}

export function StaffWeekSummary({
  storeFilter,
  todayISO,
  cache,
  onCacheChange,
}: {
  /** "all" or a store id — the Employees page's own store scope. */
  storeFilter: string;
  todayISO: string;
  cache: StaffWeekCache;
  onCacheChange: React.Dispatch<React.SetStateAction<StaffWeekCache>>;
}) {
  const thisWeekStart = mondayOf(todayISO);
  const lastWeekStart = shiftWeek(thisWeekStart, -1);
  // The week being paid this Tuesday — the one a payroll check is usually about.
  const week = cache.week ?? lastWeekStart;
  const kind = cache.kind;
  const weeks = cache.weeks;
  const setWeek = (w: string) => onCacheChange((c) => ({ ...c, week: w }));
  const setKind = (k: Kind) => onCacheChange((c) => ({ ...c, kind: k }));
  const [data, setData] = React.useState<StaffWeek | null>(() => weeks[week] ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(() => !weeks[week]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);

  // `weeks` is a dependency so emptying it mid-request cancels that request —
  // its answer predates the write that emptied it.
  React.useEffect(() => {
    const hit = weeks[week];
    if (hit) {
      setData(hit);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadStaffWeek(week)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        onCacheChange((c) => ({ ...c, weeks: { ...c.weeks, [week]: res } }));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load the weekly summary");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [week, weeks, onCacheChange]);

  React.useEffect(() => {
    if (selectedKey) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedKey]);

  const scopeStore = storeFilter !== "all" ? storeFilter : null;
  const storeNames = React.useMemo(
    () => new Map((data?.stores ?? []).map((s) => [s.id, s.name])),
    [data],
  );
  const storeName = (id: string | null) => (id ? storeNames.get(id) ?? "Unknown store" : "—");

  const inScope = React.useMemo(
    () =>
      (data?.people ?? []).filter(
        (p) => !scopeStore || p.homeStoreId === scopeStore || p.storeIds.includes(scopeStore),
      ),
    [data, scopeStore],
  );
  const kindCount = (k: Kind) => inScope.filter((p) => matchesKind(p, k)).length;
  const visible = inScope.filter((p) => matchesKind(p, kind));
  const selected = visible.find((p) => p.key === selectedKey) ?? null;

  const totals = visible.reduce(
    (acc, p) => ({
      worked: acc.worked + p.totals.worked,
      approved: acc.approved + p.totals.approved,
      ni: acc.ni + p.totals.niHours,
      cash: acc.cash + p.totals.cashHours,
      drops: acc.drops + totalDrops(p.totals.payableDrops),
      due: acc.due + p.totals.cashDue,
    }),
    { worked: 0, approved: 0, ni: 0, cash: 0, drops: 0, due: 0 },
  );
  // Everyone in scope, ignoring the kind/name filters, so it can be checked
  // against the store's sheet line for line.
  const storeSheetTotal = scopeStore
    ? inScope.reduce(
        (sum, p) =>
          sum + p.stores.filter((s) => s.storeId === scopeStore).reduce((a, s) => a + s.total, 0),
        0,
      )
    : null;

  const dates = data
    ? Array.from({ length: 7 }, (_, i) => toISODate(addDays(parseISODate(data.weekStart), i)))
    : [];
  const shownWeek = data?.weekStart ?? week;
  const scopeStoreIds = scopeStore ? [scopeStore] : (data?.stores ?? []).map((s) => s.id);

  function exportExcel() {
    if (!data) return;
    const hrs = (header: string): XlsxColumn => ({ header, width: 11, format: "decimal", sum: true });
    const gbp = (header: string): XlsxColumn => ({ header, width: 12, format: "gbp", sum: true });
    const count = (header: string): XlsxColumn => ({ header, width: 6, format: "int", sum: true });
    const columns: XlsxColumn[] = [
      { header: "Name", width: 22 },
      { header: "Type", width: 10 },
      { header: "Role", width: 18 },
      { header: "Home store", width: 17 },
      ...dates.map((d): XlsxColumn => ({ header: shortDate(d), width: 30, format: "wrap" })),
      hrs("Worked hrs (decimal)"),
      hrs("Approved hrs (decimal)"),
      hrs("Pending hrs (decimal)"),
      hrs("NI hrs (decimal)"),
      hrs("Cash hrs (decimal)"),
      gbp("NI pay £ (PAYE)"),
      gbp("Cash wage £"),
      count("SD"),
      count("LD"),
      count("SM"),
      count("LM"),
      gbp("Delivery pay £"),
      gbp("Cash due £"),
    ];
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rows = visible.map((p) => {
      const mgr = p.kind === "manager";
      const noNi = mgr || p.kind === "cover_driver";
      return [
        p.name,
        KIND_LABEL[p.kind],
        p.role ?? "",
        storeName(p.homeStoreId),
        ...p.days.map((d, i) => {
          if (!d) {
            const off = noClockDay(p.bookings[i], dates[i], todayISO);
            return off.detail ? `${off.label}\n${off.detail}` : off.label;
          }
          const worked = `${dayWindow(d)} · ${dayHoursLabel(d)}`;
          const away = d.storeId && d.storeId !== p.homeStoreId ? ` @ ${storeName(d.storeId)}` : "";
          return `${worked}\n${STATUS[d.status].label}${away}`;
        }),
        r2(p.totals.worked),
        mgr ? null : r2(p.totals.approved),
        mgr ? null : r2(p.totals.pendingHours),
        noNi ? null : r2(p.totals.niHours),
        mgr ? null : r2(p.totals.cashHours),
        noNi ? null : r2(p.totals.niPay),
        r2(p.totals.cashWage),
        p.totals.payableDrops.sd,
        p.totals.payableDrops.ld,
        p.totals.payableDrops.sm,
        p.totals.payableDrops.lm,
        r2(p.totals.deliveryWages),
        r2(p.totals.cashDue),
      ];
    });
    const scopeLabel = scopeStore ? storeName(scopeStore).toLowerCase().replace(/\s+/g, "-") : "all-stores";
    downloadXlsx(`weekly-summary-${scopeLabel}-${data.weekStart}.xlsx`, {
      name: `Week ${formatDDMMYYYY(data.weekStart).replace(/\//g, "-")}`,
      columns,
      rows,
      rowHeight: 30,
      totalLabel: `Total · ${visible.length} ${visible.length === 1 ? "person" : "people"}`,
      freezeColumns: 1,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Week + filters ---- */}
      <Card className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Previous week"
              onClick={() => setWeek(shiftWeek(shownWeek, -1))}
            >
              <ChevronLeftIcon size={18} />
            </Button>
            <div className="min-w-0 flex-1 text-center lg:flex-none lg:min-w-[17rem]">
              <p className="text-xs text-text-muted">Work week</p>
              <p className="font-semibold tabular-nums">
                {longDate(shownWeek)} – {longDate(toISODate(addDays(parseISODate(shownWeek), 6)))}
              </p>
            </div>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Next week"
              disabled={shownWeek >= thisWeekStart}
              onClick={() => setWeek(shiftWeek(shownWeek, 1))}
            >
              <ChevronRightIcon size={18} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={shownWeek}
              onChange={(v) => v && setWeek(mondayOf(v))}
              max={toISODate(addDays(parseISODate(thisWeekStart), 6))}
              placeholder="Jump to a date"
              containerClassName="w-44"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-sm font-medium transition-colors",
                  kind === k.id
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-text-subtle hover:bg-surface-hover",
                )}
              >
                {k.label}
                <span className="text-xs tabular-nums opacity-80">{kindCount(k.id)}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 lg:w-[24rem]">
            <Select
              value={selected?.key ?? ""}
              onChange={(e) => setSelectedKey(e.target.value || null)}
            >
              <option value="">Open a person…</option>
              {visible.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.kind === "employee" ? p.name : `${p.name} (${KIND_LABEL[p.kind]})`}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              iconLeft={<DownloadIcon size={16} />}
              onClick={exportExcel}
              disabled={!data || visible.length === 0}
            >
              Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* ---- Which payout this week lands on ---- */}
      {data && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm">
          <p className="text-text-primary">
            This work week is paid on the{" "}
            <span className="font-semibold">Tuesday {longDate(data.paymentDate)}</span> payout —
            open the week of <span className="font-semibold">{formatDDMMYYYY(data.payoutWeekStart)}</span>{" "}
            on Tuesday Payout to see that sheet.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scopeStoreIds.map((id) => {
              const p = data.payouts.find((x) => x.storeId === id);
              return (
                <Badge
                  key={id}
                  variant={p?.status === "confirmed" ? "success" : p ? "gold" : "neutral"}
                >
                  {storeName(id)}:{" "}
                  {p?.status === "confirmed"
                    ? `confirmed${p.confirmedAt ? ` ${formatDDMMYYYY(p.confirmedAt)}` : ""}${
                        p.confirmedByName ? ` by ${p.confirmedByName}` : ""
                      }`
                    : p
                      ? "draft"
                      : "not generated yet"}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {(error || data?.loadError) && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">Couldn&apos;t load the week</p>
          <p className="text-xs mt-1 text-danger/90">
            The figures below may be incomplete — an empty list here does not mean nobody worked.
            ({error ?? data?.loadError})
          </p>
        </div>
      )}

      {/* ---- The week grid ---- */}
      {!data ? (
        <Card>
          <p className="text-sm text-text-muted">{loading ? "Loading the week…" : "Nothing loaded."}</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClockIcon />}
            title="No clock records"
            description={
              inScope.length === 0
                ? "Nobody clocked in this week for the selected store."
                : "Nobody matches this filter. Pick Everyone to see the whole week."
            }
          />
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
          {/* Desktop / print: one row per person, one column per day */}
          <Card className="hidden md:block print:block p-0 overflow-hidden">
            <div className="overflow-x-auto print-sheet">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                    <th className="px-3 py-2 font-medium">Name</th>
                    {dates.map((d) => (
                      <th key={d} className="px-2 py-2 font-medium text-center whitespace-nowrap">
                        {shortDate(d)}
                      </th>
                    ))}
                    <th className="px-2 py-2 font-medium text-right">Worked</th>
                    <th className="px-2 py-2 font-medium text-right">Approved</th>
                    <th className="px-2 py-2 font-medium text-right">NI hrs</th>
                    <th className="px-2 py-2 font-medium text-right">Cash hrs</th>
                    <th className="px-2 py-2 font-medium text-right">Drops</th>
                    <th className="px-3 py-2 font-medium text-right">Cash due</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const mgr = p.kind === "manager";
                    const noNi = mgr || p.kind === "cover_driver";
                    return (
                      <tr
                        key={p.key}
                        onClick={() => setSelectedKey(p.key)}
                        className={cn(
                          "cursor-pointer border-t border-border/60 align-top transition-colors hover:bg-surface-hover",
                          p.key === selectedKey && "bg-gold/10 hover:bg-gold/15",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <PersonName person={p} storeName={storeName} />
                        </td>
                        {p.days.map((d, i) => (
                          <td key={i} className="px-2 py-2.5 text-center">
                            <DayCell
                              day={d}
                              person={p}
                              noClock={d ? null : noClockDay(p.bookings[i], dates[i], todayISO)}
                              storeName={storeName}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {shortHours(p.totals.worked)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap font-medium">
                          {mgr ? <Muted /> : shortHours(p.totals.approved)}
                          {!mgr && p.totals.pendingHours > 0 && (
                            <span className="block text-[11px] font-normal text-warning">
                              +{shortHours(p.totals.pendingHours)} pending
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {noNi ? <Muted /> : shortHours(p.totals.niHours)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {mgr ? <Muted /> : shortHours(p.totals.cashHours)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {totalDrops(p.totals.payableDrops) || <Muted />}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold">
                          {formatGBP(p.totals.cashDue)}
                          {p.payoutMismatch && (
                            <span className="block text-[11px] font-normal text-danger">
                              differs from confirmed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-3 py-2.5">
                      Total · {visible.length} {visible.length === 1 ? "person" : "people"}
                    </td>
                    <td colSpan={7} />
                    <td className="px-2 py-2.5 text-right tabular-nums">{shortHours(totals.worked)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{shortHours(totals.approved)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{shortHours(totals.ni)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{shortHours(totals.cash)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{totals.drops}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatGBP(totals.due)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Phone: one card per person */}
          <div className="flex flex-col gap-2 md:hidden print:hidden">
            {visible.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedKey(p.key)}
                className={cn(
                  "rounded-2xl border bg-surface p-3 text-left transition-colors",
                  p.key === selectedKey ? "border-gold/60 bg-gold/10" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <PersonName person={p} storeName={storeName} />
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatGBP(p.totals.cashDue)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {p.days.map((d, i) => {
                    const off = d ? null : noClockDay(p.bookings[i], dates[i], todayISO);
                    return (
                      <div
                        key={i}
                        className="rounded-md bg-surface-hover px-0.5 py-1 text-center text-[11px] leading-tight"
                        title={off ? [off.label, off.detail].filter(Boolean).join(" · ") : undefined}
                      >
                        <span className="block text-text-muted">{WEEKDAY_SHORT[i][0]}</span>
                        {d ? (
                          <span className="tabular-nums">
                            {Math.round((d.clockIn ? d.workedHours : d.approvedHours) * 10) / 10}
                          </span>
                        ) : off?.missed ? (
                          <span className="text-warning">Miss</span>
                        ) : (
                          <span className="text-text-muted">{off?.label === "Booked" ? "Bkd" : off?.label === "On Leave" ? "Lve" : "Off"}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-text-muted tabular-nums">
                  {p.kind === "manager"
                    ? `${shortHours(p.totals.worked)} on site · ${totalDrops(p.totals.payableDrops)} approved drops`
                    : `${shortHours(p.totals.approved)} approved${
                        p.kind === "employee" ? ` · ${shortHours(p.totals.niHours)} NI` : ""
                      } · ${shortHours(p.totals.cashHours)} cash${
                        totalDrops(p.totals.payableDrops) ? ` · ${totalDrops(p.totals.payableDrops)} drops` : ""
                      }`}
                </p>
              </button>
            ))}
            <p className="px-1 text-xs text-text-muted tabular-nums">
              Total cash due for {visible.length} {visible.length === 1 ? "person" : "people"}:{" "}
              <span className="font-semibold text-text-primary">{formatGBP(totals.due)}</span>
            </p>
          </div>

          <div className="flex flex-col gap-1 px-1 text-xs text-text-muted">
            <p>
              Day cells show clock-in to clock-out and hours worked. A day with no clock record
              reads against the Rota: Day Off (or On Leave, where the Rota says so) unless a shift
              was booked, in which case it shows as Not clocked. Approved, NI, Cash, Drops and Cash due count approved work only — the same
              figures the Tuesday payout pays. Cash due is cash wages plus delivery pay.
            </p>
            {scopeStore && storeSheetTotal != null && (
              <p>
                On the {storeName(scopeStore)} payout sheet, employees, cover drivers and managers
                come to{" "}
                <span className="font-semibold text-text-primary">{formatGBP(storeSheetTotal)}</span>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---- The drill-down ---- */}
      <div ref={detailRef} className="scroll-mt-4">
        {selected && data && (
          <PersonDetail
            person={selected}
            dates={dates}
            todayISO={todayISO}
            paymentDate={data.paymentDate}
            storeName={storeName}
            onClose={() => setSelectedKey(null)}
          />
        )}
      </div>
    </div>
  );
}

function matchesKind(p: StaffWeekPerson, k: Kind): boolean {
  return k === "all" || p.kind === k;
}

function Muted() {
  return <span className="text-text-muted">—</span>;
}

function PersonName({
  person,
  storeName,
}: {
  person: StaffWeekPerson;
  storeName: (id: string | null) => string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-1.5 font-medium text-text-primary">
        {person.name}
        {person.left && <Badge className="py-0 text-[10px]">Left</Badge>}
        {person.payoutMismatch && (
          <span className="text-danger" title="Differs from the confirmed payout">
            <AlertIcon size={14} />
          </span>
        )}
      </p>
      <p className="text-xs text-text-muted">
        {person.role ?? KIND_LABEL[person.kind]} ·{" "}
        {storeName(person.homeStoreId)}
      </p>
    </div>
  );
}

/** Same two-line layout as DayCell, so the label sits on the hours line of its row. */
function NoClockLabel({ off }: { off: NoClock }) {
  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span
        className="text-[11px] text-text-muted tabular-nums whitespace-nowrap"
        aria-hidden={!off.detail}
      >
        {off.detail ?? " "}
      </span>
      <span className={cn("whitespace-nowrap", off.missed ? "text-warning" : "text-text-muted")}>
        {off.label}
      </span>
    </div>
  );
}

function DayCell({
  day,
  person,
  noClock,
  storeName,
}: {
  day: StaffWeekDay | null;
  person: StaffWeekPerson;
  noClock: NoClock | null;
  storeName: (id: string | null) => string;
}) {
  if (!day) return noClock ? <NoClockLabel off={noClock} /> : <Muted />;
  const away = !!day.storeId && day.storeId !== person.homeStoreId;
  const timedShifts = day.shifts.filter((s) => !s.deliveriesOnly).length;
  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span className="text-[11px] text-text-muted tabular-nums whitespace-nowrap">
        {dayWindow(day)}
      </span>
      <span className="tabular-nums whitespace-nowrap">{dayHoursLabel(day)}</span>
      {(timedShifts > 1 || away) && (
        <span className="text-[10px] text-text-muted whitespace-nowrap">
          {timedShifts > 1 && `${timedShifts} shifts`}
          {timedShifts > 1 && away && " · "}
          {away && <span className="text-gold">{storeName(day.storeId)}</span>}
        </span>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-hover/40 p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <div className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{value}</div>
      {sub && (
        <p className={cn("mt-0.5 text-xs", tone === "warning" ? "text-warning" : "text-text-muted")}>
          {sub}
        </p>
      )}
    </div>
  );
}

function PersonDetail({
  person: p,
  dates,
  todayISO,
  paymentDate,
  storeName,
  onClose,
}: {
  person: StaffWeekPerson;
  dates: string[];
  todayISO: string;
  paymentDate: string;
  storeName: (id: string | null) => string;
  onClose: () => void;
}) {
  const mgr = p.kind === "manager";
  const cover = p.kind === "cover_driver";
  const r = p.rates;
  const noLineReason = cover
    ? p.totals.approved === 0
      ? "no days are approved yet"
      : "nothing approved carries any pay"
    : !r.paidAnyCash
      ? "every approved hour is NI — there's no cash rate on file"
      : p.totals.approved === 0
        ? "no hours are approved yet"
        : "every approved hour falls inside the NI allowance";

  return (
    <Card>
      <CardHeader
        action={
          <Button variant="ghost" size="sm" onClick={onClose} className="print:hidden">
            Close
          </Button>
        }
      >
        <CardTitle className="flex flex-wrap items-center gap-2">
          {p.name}
          {mgr && <Badge variant="gold">Manager</Badge>}
          {cover && <Badge variant="gold">Cover driver</Badge>}
          {p.kind === "employee" && p.isDriver && <Badge>Driver</Badge>}
          {p.left && <Badge>{cover ? "Inactive" : "Left"}</Badge>}
        </CardTitle>
        <CardDescription>
          {p.role ?? "Employee"} · home store {storeName(p.homeStoreId)}
          {mgr
            ? ` · drops at ${formatGBP(r.short)} short / ${formatGBP(r.long)} long`
            : cover
              ? ` · cash only, ${formatGBP(r.cash)}/hr · drops ${formatGBP(r.short)} short / ${formatGBP(r.long)} long (current rates — approved days pay the rates snapshotted at approval)`
              : ` · NI allowance ${r.bankLimit}h/week · ${
                r.paidAnyCash ? `cash ${formatGBP(r.cash)}/hr` : "no cash rate (all hours NI)"
              } · NI ${formatGBP(r.ni)}/hr${
                p.isDriver ? ` · drops ${formatGBP(r.short)} short / ${formatGBP(r.long)} long` : ""
              }`}
          {mgr && p.fixedDailyWage != null && (
            <> · fixed daily wage {formatGBP(p.fixedDailyWage)} (paid outside this app)</>
          )}
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-4">
        {/* Warnings first — each is a reason the payout may not be what's expected */}
        {p.totals.openDays > 0 && (
          <Notice tone="neutral">
            Still clocked in on {p.totals.openDays === 1 ? "one day" : `${p.totals.openDays} days`}. A
            day with a running shift can&apos;t be approved until they clock out.
          </Notice>
        )}
        {p.totals.pendingHours > 0 && (
          <Notice tone="warning">
            {shortHours(p.totals.pendingHours)} worked but not approved yet, so it isn&apos;t on the
            payout. Approve it in the Daily Approval tab.
          </Notice>
        )}
        {p.totals.pendingDrops > 0 && (
          <Notice tone="warning">
            {p.totals.pendingDrops} drop{p.totals.pendingDrops === 1 ? "" : "s"} recorded but not
            approved yet — not on the payout until signed off.
          </Notice>
        )}
        {p.payoutMismatch && (
          <Notice tone="danger">
            The confirmed payout paid a different amount than this week now computes — something was
            approved or changed after it was confirmed. A confirmed sheet is a frozen record: a Super
            Admin must unlock, regenerate and re-confirm it to restate it.
          </Notice>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {mgr ? (
            <>
              <Metric label="Days clocked" value={p.totals.daysWorked} sub="monitoring only" />
              <Metric
                label="Hours on site"
                value={<HoursMinsDisplay hours={p.totals.worked} size="md" />}
                sub="not paid by this app"
              />
              <Metric
                label="Approved drops"
                value={totalDrops(p.totals.payableDrops)}
                sub={dropsLabel(p.totals.payableDrops)}
              />
              <Metric label="Delivery pay" value={formatGBP(p.totals.deliveryWages)} />
            </>
          ) : cover ? (
            <>
              <Metric
                label="Worked (clocked)"
                value={<HoursMinsDisplay hours={p.totals.worked} size="md" />}
                sub={`${p.totals.daysWorked} day${p.totals.daysWorked === 1 ? "" : "s"}`}
              />
              <Metric
                label="Approved"
                value={<HoursMinsDisplay hours={p.totals.approved} size="md" />}
                sub={
                  p.totals.pendingHours > 0
                    ? `${shortHours(p.totals.pendingHours)} still pending`
                    : "all signed off"
                }
                tone={p.totals.pendingHours > 0 ? "warning" : undefined}
              />
              <Metric
                label="Cash hours"
                value={<HoursMinsDisplay hours={p.totals.cashHours} size="md" />}
                sub={`${formatGBP(p.totals.cashWage)} cash wage · no NI`}
              />
              <Metric
                label="Deliveries"
                value={totalDrops(p.totals.payableDrops)}
                sub={`${formatGBP(p.totals.deliveryWages)} delivery pay`}
              />
            </>
          ) : (
            <>
              <Metric
                label="Worked (clocked)"
                value={<HoursMinsDisplay hours={p.totals.worked} size="md" />}
                sub={`${p.totals.daysWorked} day${p.totals.daysWorked === 1 ? "" : "s"}`}
              />
              <Metric
                label="Approved"
                value={<HoursMinsDisplay hours={p.totals.approved} size="md" />}
                sub={
                  p.totals.pendingHours > 0
                    ? `${shortHours(p.totals.pendingHours)} still pending`
                    : "all signed off"
                }
                tone={p.totals.pendingHours > 0 ? "warning" : undefined}
              />
              <Metric
                label="NI hours (weekly rule)"
                value={<HoursMinsDisplay hours={p.totals.niHours} size="md" />}
                sub={`${formatGBP(p.totals.niPay)} via PAYE`}
              />
              <Metric
                label="Cash hours"
                value={<HoursMinsDisplay hours={p.totals.cashHours} size="md" />}
                sub={`${formatGBP(p.totals.cashWage)} cash wage`}
              />
              <Metric
                label="Deliveries"
                value={p.isDriver ? totalDrops(p.totals.payableDrops) : <Muted />}
                sub={p.isDriver ? `${formatGBP(p.totals.deliveryWages)} delivery pay` : "not a driver"}
              />
            </>
          )}
        </div>

        {/* Day by day */}
        <div className="overflow-x-auto -mx-1">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 font-medium">Store</th>
                <th className="px-3 py-2 font-medium">Shifts (in – out)</th>
                <th className="px-3 py-2 font-medium text-right">Worked</th>
                <th className="px-3 py-2 font-medium text-right">Approved</th>
                <th className="px-3 py-2 font-medium text-right">Drops</th>
                <th className="px-3 py-2 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {p.days.map((d, i) =>
                d ? (
                  <tr key={dates[i]} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium" data-label="">
                      {shortDate(dates[i])}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" data-label="Store">
                      <span className={cn(d.storeId !== p.homeStoreId && "text-gold")}>
                        {storeName(d.storeId)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" data-label="Shifts">
                      <ul className="flex flex-col gap-1">
                        {d.shifts.map((s, j) => (
                          <li key={j} className="flex flex-wrap items-center gap-1.5 tabular-nums">
                            {s.deliveriesOnly ? (
                              <span className="text-text-muted">Drops only (no clock times)</span>
                            ) : s.approvedWithoutClock ? (
                              <span className="text-text-muted">
                                No clock record — {shortHours(s.approvedHours ?? 0)} approved
                              </span>
                            ) : (
                              <>
                                <span>
                                  {hhmm(s.clockIn)} – {s.clockOut ? hhmm(s.clockOut) : "still on shift"}
                                </span>
                                {s.clockOut && (
                                  <span className="text-xs text-text-muted">{shortHours(s.hours)}</span>
                                )}
                              </>
                            )}
                            {(s.clockOut || s.deliveriesOnly || s.approvedWithoutClock) &&
                              (mgr ? totalDrops(s.drops) > 0 : true) && (
                                <span
                                  className={cn("text-xs", s.approved ? "text-success" : "text-warning")}
                                >
                                  {s.approved ? "✓ approved" : "pending"}
                                </span>
                              )}
                            {s.approvedHours != null &&
                              !s.approvedWithoutClock &&
                              Math.abs(s.approvedHours - s.hours) > 1 / 120 && (
                              <span className="text-xs text-text-muted">
                                approved as {shortHours(s.approvedHours)}
                              </span>
                            )}
                            {totalDrops(s.drops) > 0 && (
                              <span className="text-xs text-text-muted">{dropsLabel(s.drops)}</span>
                            )}
                            {s.storeId && s.storeId !== d.storeId && (
                              <span className="text-xs text-gold">at {storeName(s.storeId)}</span>
                            )}
                            {s.manual && <Badge className="py-0 text-[10px]">Manual</Badge>}
                            {s.autoClockedOut && (
                              <Badge variant="warning" className="py-0 text-[10px]">
                                Auto clock-out
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap" data-label="Worked">
                      {shortHours(d.workedHours)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium"
                      data-label="Approved"
                    >
                      {mgr ? <Muted /> : shortHours(d.approvedHours)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap" data-label="Drops">
                      {dropsLabel(d.drops)}
                    </td>
                    <td className="px-3 py-2.5 text-center" data-label="Status">
                      <Badge variant={STATUS[d.status].badge}>{STATUS[d.status].label}</Badge>
                    </td>
                  </tr>
                ) : (
                  <NoClockRow
                    key={dates[i]}
                    date={dates[i]}
                    off={noClockDay(p.bookings[i], dates[i], todayISO)}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>

        {/* Where it lands */}
        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">On the Tuesday {longDate(paymentDate)} payout</p>
            <p className="text-sm font-semibold tabular-nums">{formatGBP(p.totals.cashDue)}</p>
          </div>
          {p.stores.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">
              No cash line: {mgr ? "no approved drops this week" : noLineReason}.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {p.stores.map((s) => {
                const differs = s.frozenTotal != null && Math.abs(s.frozenTotal - s.total) > 0.005;
                return (
                  <li
                    key={s.storeId}
                    className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{storeName(s.storeId)} payout sheet</p>
                      <p className="text-xs text-text-muted tabular-nums">
                        {!mgr && s.cashHours > 0 && (
                          <>
                            Cash {shortHours(s.cashHours)} × {formatGBP(s.cashRate)} ={" "}
                            {formatGBP(s.cashWage)}
                          </>
                        )}
                        {!mgr && s.cashHours > 0 && totalDrops(s.drops) > 0 && " · "}
                        {totalDrops(s.drops) > 0 && (
                          <>
                            {dropsLabel(s.drops)} = {formatGBP(s.deliveryWages)}
                          </>
                        )}
                        {s.total === 0 && "Nothing due now"}
                      </p>
                      {s.frozenTotal != null && (
                        <p className={cn("text-xs", differs ? "text-danger" : "text-success")}>
                          Confirmed sheet paid {formatGBP(s.frozenTotal)}
                          {differs && ` — live figure is now ${formatGBP(s.total)}`}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatGBP(s.total)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {p.kind === "employee" && (
          <p className="text-xs text-text-muted">
            NI hours follow the weekly rule the payout uses: the first {r.bankLimit}h approved at the
            home store are NI, and every hour at another store is cash. NI Monthly caps a calendar
            month instead, so weekly NI figures won&apos;t add up to it exactly. NI pay is shown for
            reference — it goes through PAYE, not the cash payout.
          </p>
        )}
      </div>
    </Card>
  );
}

function NoClockRow({ date, off }: { date: string; off: NoClock }) {
  return (
    <tr className="border-t border-border/60">
      <td className="px-3 py-2.5 whitespace-nowrap font-medium" data-label="">
        {shortDate(date)}
      </td>
      <td colSpan={6} className="px-3 py-2.5" data-label="">
        <span className={off.missed ? "text-warning" : "text-text-muted"}>{off.label}</span>
        {off.detail && (
          <span className="ml-2 text-xs text-text-muted tabular-nums">{off.detail}</span>
        )}
        {off.missed && (
          <span className="ml-2 text-xs text-text-muted">
            — nothing to pay unless a manual clock entry is added and approved
          </span>
        )}
      </td>
    </tr>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "neutral" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
        tone === "neutral" && "border-border bg-surface-hover text-text-subtle",
      )}
    >
      {children}
    </div>
  );
}
