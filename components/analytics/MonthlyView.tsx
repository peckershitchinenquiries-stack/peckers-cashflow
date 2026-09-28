"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase";
import { StatTile } from "./StatTile";
import type { AnalyticsEmployee } from "./AnalyticsView";
import {
  approvedHoursByEmployeeStore,
  cashHoursFromStoreTotal,
  PAY_CLOCK_SESSION_COLUMNS,
  round2,
  type StoreClockRow,
  type StoreClockSessionRow,
} from "@/lib/cash-flow";
import { useChartColors } from "./useChartColors";
import {
  endOfISOWeek,
  endOfMonth,
  formatINR,
  monthLabel,
  MONTH_LONG,
  startOfISOWeek,
  startOfMonth,
  toISODate,
} from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type WeeklyAgg = {
  weekStart: string;
  weekLabel: string;
  sales: number;
  expenses: number;
  empCash: number;
  net: number;
};

/** Everything a week's cash needs: the day headers and the shifts under them. */
const CLOCK_COLUMNS =
  "employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, hours_approved, approved_hours, short_deliveries_count, long_deliveries_count";

function getMonthWeeks(year: number, monthIdx: number) {
  // Returns array of {start, end} for ISO weeks that overlap this month, indexed by Monday.
  const firstOfMonth = new Date(year, monthIdx, 1);
  const lastOfMonth = endOfMonth(firstOfMonth);

  const out: { start: Date; end: Date }[] = [];
  let cur = startOfISOWeek(firstOfMonth);
  while (cur.getTime() <= lastOfMonth.getTime()) {
    const end = endOfISOWeek(cur);
    out.push({ start: cur, end });
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

export function MonthlyView({
  storeId,
  employees,
}: {
  storeId: string;
  employees: AnalyticsEmployee[];
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const colors = useChartColors();
  const now = new Date();
  // Stable key so the effect re-runs when the roster or its rates change.
  const empKey = employees
    .map((e) => `${e.id}:${e.store_id}:${e.hourly_cash_rate}:${e.bank_weekly_hours_limit}`)
    .join(",");
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth()); // 0-11
  const [loading, setLoading] = React.useState(true);
  const [weeks, setWeeks] = React.useState<WeeklyAgg[]>([]);
  const [prevTotals, setPrevTotals] = React.useState<{
    sales: number;
    exp: number;
    empCash: number;
    net: number;
  } | null>(null);

  const totals = React.useMemo(() => {
    const sales = weeks.reduce((s, w) => s + w.sales, 0);
    const exp = weeks.reduce((s, w) => s + w.expenses, 0);
    const empCash = weeks.reduce((s, w) => s + w.empCash, 0);
    return { sales, exp, empCash, net: sales - exp - empCash };
  }, [weeks]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  React.useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const target = new Date(year, month, 1);
        const monthStart = startOfMonth(target);
        const monthEnd = endOfMonth(target);

        const prevTarget = new Date(year, month - 1, 1);
        const prevStart = startOfMonth(prevTarget);
        const prevEnd = endOfMonth(prevTarget);

        // Fetch entries spanning a wider range — first/last ISO weeks may extend before/after the month.
        const fetchStart = startOfISOWeek(monthStart);
        const fetchEnd = endOfISOWeek(monthEnd);

        const fetchPrevStart = startOfISOWeek(prevStart);
        const fetchPrevEnd = endOfISOWeek(prevEnd);

        const monthWeeks = getMonthWeeks(year, month);
        const monthWeekStarts = monthWeeks.map((w) => toISODate(w.start));

        const prevWeeks = getMonthWeeks(prevTarget.getFullYear(), prevTarget.getMonth());
        const prevWeekStarts = prevWeeks.map((w) => toISODate(w.start));

        const [
          entriesRes,
          clocksRes,
          sessionsRes,
          prevEntriesRes,
          prevClocksRes,
          prevSessionsRes,
          coverRes,
          prevCoverRes,
        ] = await Promise.all([
          supabase
            .from("daily_cash_entries")
            .select("entry_date, vita_mojo_sales, supermarket_expenses")
            .eq("store_id", storeId)
            .gte("entry_date", toISODate(fetchStart))
            .lte("entry_date", toISODate(fetchEnd)),
          // Estate-wide and NOT store-filtered, deliberately. Cash is owed by the
          // store each SHIFT was worked at, and the home-store NI allowance is a
          // rule over the employee's whole week — both need every row. Reading
          // employee_hours_computed.cash_amount_due instead billed a split week's
          // cash wholly to the home store and NI-limited the away hours, which is
          // the bug Update 218 fixed everywhere else (Update 225).
          supabase
            .from("clock_events")
            .select(CLOCK_COLUMNS)
            .gte("event_date", toISODate(fetchStart))
            .lte("event_date", toISODate(fetchEnd)),
          supabase
            .from("clock_sessions")
            .select(PAY_CLOCK_SESSION_COLUMNS)
            .gte("event_date", toISODate(fetchStart))
            .lte("event_date", toISODate(fetchEnd)),
          supabase
            .from("daily_cash_entries")
            .select("entry_date, vita_mojo_sales, supermarket_expenses")
            .eq("store_id", storeId)
            .gte("entry_date", toISODate(fetchPrevStart))
            .lte("entry_date", toISODate(fetchPrevEnd)),
          supabase
            .from("clock_events")
            .select(CLOCK_COLUMNS)
            .gte("event_date", toISODate(fetchPrevStart))
            .lte("event_date", toISODate(fetchPrevEnd)),
          supabase
            .from("clock_sessions")
            .select(PAY_CLOCK_SESSION_COLUMNS)
            .gte("event_date", toISODate(fetchPrevStart))
            .lte("event_date", toISODate(fetchPrevEnd)),
          // Cover drivers are cash-only and paid from the same till. Keyed per
          // DAY, so they're bucketed into weeks below rather than joined on
          // week_start_date. Approved days only — that's money actually owed.
          supabase
            .from("cover_driver_hours_computed")
            .select("work_date, total_pay")
            .eq("store_id", storeId)
            .eq("approved", true)
            .gte("work_date", toISODate(fetchStart))
            .lte("work_date", toISODate(fetchEnd)),
          supabase
            .from("cover_driver_hours_computed")
            .select("work_date, total_pay")
            .eq("store_id", storeId)
            .eq("approved", true)
            .gte("work_date", toISODate(fetchPrevStart))
            .lte("work_date", toISODate(fetchPrevEnd)),
        ]);

        if (!active) return;

        // One week's staff cash at THIS store. The NI allowance is a weekly rule,
        // so each week is priced on its own rather than the month being summed
        // and split once.
        const staffCashForWeek = (
          clocks: StoreClockRow[],
          sessions: StoreClockSessionRow[],
          startISO: string,
          endISO: string,
        ): number => {
          const inWeek = <T extends { event_date: string }>(rows: T[]) =>
            rows.filter((r) => r.event_date >= startISO && r.event_date <= endISO);
          const hoursByEmpStore = approvedHoursByEmployeeStore(
            inWeek(clocks),
            inWeek(sessions),
          );
          return round2(
            employees.reduce((sum, emp) => {
              const hoursHere = hoursByEmpStore.get(`${emp.id}:${storeId}`) ?? 0;
              const cashHours = cashHoursFromStoreTotal(hoursHere, storeId, emp);
              return sum + cashHours * (Number(emp.hourly_cash_rate) || 0);
            }, 0),
          );
        };

        const aggregateForWeeks = (
          weekDefs: { start: Date; end: Date }[],
          entries: Array<{ entry_date: string; vita_mojo_sales: number; supermarket_expenses: number }>,
          clocks: StoreClockRow[],
          sessions: StoreClockSessionRow[],
          cover: Array<{ work_date: string; total_pay: number }>,
        ): WeeklyAgg[] => {
          return weekDefs.map((w, idx) => {
            const startISO = toISODate(w.start);
            const endISO = toISODate(w.end);
            const weekEntries = entries.filter(
              (e) => e.entry_date >= startISO && e.entry_date <= endISO,
            );
            const sales = weekEntries.reduce((s, r) => s + Number(r.vita_mojo_sales || 0), 0);
            const expenses = weekEntries.reduce(
              (s, r) => s + Number(r.supermarket_expenses || 0),
              0,
            );
            const staffCash = staffCashForWeek(clocks, sessions, startISO, endISO);
            const coverCash = cover
              .filter((c) => c.work_date >= startISO && c.work_date <= endISO)
              .reduce((s, r) => s + Number(r.total_pay || 0), 0);
            const empCash = staffCash + coverCash;
            return {
              weekStart: startISO,
              weekLabel: `W${idx + 1}`,
              sales,
              expenses,
              empCash,
              net: sales - expenses - empCash,
            };
          });
        };

        const computed = aggregateForWeeks(
          monthWeeks,
          (entriesRes.data ?? []) as any[],
          (clocksRes.data ?? []) as unknown as StoreClockRow[],
          (sessionsRes.data ?? []) as unknown as StoreClockSessionRow[],
          (coverRes.data ?? []) as any[],
        );

        const prevAgg = aggregateForWeeks(
          prevWeeks,
          (prevEntriesRes.data ?? []) as any[],
          (prevClocksRes.data ?? []) as unknown as StoreClockRow[],
          (prevSessionsRes.data ?? []) as unknown as StoreClockSessionRow[],
          (prevCoverRes.data ?? []) as any[],
        );
        const prev = prevAgg.reduce(
          (acc, w) => ({
            sales: acc.sales + w.sales,
            exp: acc.exp + w.expenses,
            empCash: acc.empCash + w.empCash,
            net: acc.net + w.net,
          }),
          { sales: 0, exp: 0, empCash: 0, net: 0 },
        );

        setWeeks(computed);
        setPrevTotals(prev);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
    // `employees` is read inside but keyed by empKey, so a new array identity
    // with the same roster doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, year, month, storeId, empKey]);

  const yearOptions = React.useMemo(() => {
    const arr = [];
    for (let y = now.getFullYear() - 4; y <= now.getFullYear() + 1; y++) arr.push(y);
    return arr;
  }, [now]);

  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const delta = (curr: number, prev: number) => {
    if (prev === 0 && curr === 0) return { pct: 0, dir: "flat" as const };
    if (prev === 0) return { pct: 100, dir: curr >= 0 ? ("up" as const) : ("down" as const) };
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct, dir: pct >= 0 ? ("up" as const) : ("down" as const) };
  };

  const deltaSales = prevTotals ? delta(totals.sales, prevTotals.sales) : null;
  const deltaExp = prevTotals ? delta(totals.exp, prevTotals.exp) : null;
  const deltaEmp = prevTotals ? delta(totals.empCash, prevTotals.empCash) : null;
  const deltaNet = prevTotals ? delta(totals.net, prevTotals.net) : null;

  const renderDelta = (
    d: { pct: number; dir: "up" | "down" | "flat" } | null,
    invert = false,
  ) => {
    if (!d) return null;
    if (d.dir === "flat") return <span className="text-xs text-text-muted">no change</span>;
    const positive = invert ? d.dir === "down" : d.dir === "up";
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs ${
          positive ? "text-success" : "text-danger"
        }`}
      >
        {d.dir === "up" ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
        {Math.abs(d.pct).toFixed(1)}% vs last month
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted font-medium">
              Selected Month
            </p>
            <p className="text-lg font-semibold mt-1">
              {monthLabel(new Date(year, month, 1))}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* `sm:contents` drops these wrappers on wider screens, so the
                desktop row is unchanged; on a phone they become two tidy rows. */}
            <div className="grid grid-cols-[1fr_auto] gap-2 w-full sm:contents">
            <Select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="min-w-[120px]"
            >
              {MONTH_LONG.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </Select>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-w-[90px]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            </div>
            <div className="flex items-center gap-2 w-full sm:contents [&>button:nth-child(2)]:flex-1">
            <Button variant="secondary" size="icon" onClick={goPrev} aria-label="Previous month">
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth());
              }}
              disabled={isCurrent}
            >
              This month
            </Button>
            <Button variant="secondary" size="icon" onClick={goNext} aria-label="Next month">
              <ChevronRightIcon />
            </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          <>
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
          </>
        ) : (
          <>
            <StatTile
              label="Monthly Sales"
              value={totals.sales}
              tone="gold"
              hint={renderDelta(deltaSales)}
            />
            <StatTile
              label="Monthly Expenses"
              value={totals.exp}
              hint={renderDelta(deltaExp, true)}
            />
            <StatTile
              label="Employee Cash"
              value={totals.empCash}
              tone="danger"
              hint={renderDelta(deltaEmp, true)}
            />
            <StatTile
              label="Monthly Net"
              value={totals.net}
              tone={totals.net >= 0 ? "success" : "danger"}
              hint={renderDelta(deltaNet)}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Net Cash Trend</CardTitle>
          <CardDescription>Net per ISO week (Mon → Sun)</CardDescription>
        </CardHeader>
        {loading ? (
          <Skeleton className="h-[260px]" />
        ) : weeks.every((w) => w.sales === 0 && w.expenses === 0 && w.empCash === 0) ? (
          <EmptyState
            icon={<ChartIcon />}
            title="No activity this month"
            description="Once entries and hours are logged, weekly trends will appear here."
          />
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} width={70} />
                <Tooltip
                  formatter={(v: number) => formatINR(v)}
                  cursor={{ stroke: colors.cursorStroke }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke={colors.gold}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: colors.gold, stroke: colors.gold }}
                  activeDot={{ r: 6 }}
                  name="Net"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales · Expenses · Employee Cash</CardTitle>
          <CardDescription>Stacked breakdown per week</CardDescription>
        </CardHeader>
        {loading ? (
          <Skeleton className="h-[280px]" />
        ) : weeks.every((w) => w.sales === 0 && w.expenses === 0 && w.empCash === 0) ? (
          <EmptyState
            icon={<ChartIcon />}
            title="Nothing to chart"
            description="Add some entries and employee hours to see the breakdown."
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} width={70} />
                <Tooltip
                  formatter={(v: number) => formatINR(v)}
                  cursor={{ fill: colors.cursorFill }}
                />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill={colors.gold} radius={[6, 6, 0, 0]} />
                <Bar
                  dataKey="expenses"
                  stackId="costs"
                  name="Expenses"
                  fill={colors.danger}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="empCash"
                  stackId="costs"
                  name="Employee Cash Pay"
                  fill={colors.warning}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
