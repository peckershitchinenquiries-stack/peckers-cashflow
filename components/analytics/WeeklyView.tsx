"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase";
import { HoursMinsDisplay } from "@/components/ui/HoursMinsDisplay";
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
  addDays,
  eachDay,
  endOfISOWeek,
  formatDDMMYYYY,
  formatINR,
  isSameDay,
  startOfISOWeek,
  toISODate,
  WEEKDAY_SHORT,
  weekLabel,
} from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DailyRow = {
  date: string;
  day: string;
  sales: number;
  expenses: number;
};

type EmpPay = {
  employee_id: string;
  employee_name: string;
  cash_hours: number;
  cash_amount_due: number;
  /** Hours worked AT THIS STORE, not the employee's week total. */
  total_hours_worked: number;
};

/** Everything a week's cash needs: the day headers and the shifts under them. */
const CLOCK_COLUMNS =
  "employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, hours_approved, approved_hours, short_deliveries_count, long_deliveries_count";

export function WeeklyView({
  storeId,
  employees,
}: {
  storeId: string;
  employees: AnalyticsEmployee[];
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const colors = useChartColors();
  const [weekStart, setWeekStart] = React.useState<Date>(startOfISOWeek(new Date()));
  const [loading, setLoading] = React.useState(true);
  const [daily, setDaily] = React.useState<DailyRow[]>([]);
  const [empPay, setEmpPay] = React.useState<EmpPay[]>([]);
  const [coverPay, setCoverPay] = React.useState<Array<{ total_pay: number }>>([]);

  const weekEnd = React.useMemo(() => endOfISOWeek(weekStart), [weekStart]);
  // Stable key so the effect re-runs when the roster or its rates change.
  const empKey = employees
    .map((e) => `${e.id}:${e.store_id}:${e.hourly_cash_rate}:${e.bank_weekly_hours_limit}`)
    .join(",");

  const totals = React.useMemo(() => {
    const sales = daily.reduce((s, r) => s + r.sales, 0);
    const exp = daily.reduce((s, r) => s + r.expenses, 0);
    const empCash = empPay.reduce((s, r) => s + Number(r.cash_amount_due || 0), 0);
    // Cover drivers are cash-only and paid from the same till, so leaving them
    // out made a weekend look cheaper than it was.
    const coverCash = coverPay.reduce((s, r) => s + Number(r.total_pay || 0), 0);
    return {
      sales,
      exp,
      empCash,
      coverCash,
      cashPay: empCash + coverCash,
      net: sales - exp - empCash - coverCash,
    };
  }, [daily, empPay, coverPay]);

  React.useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const startISO = toISODate(weekStart);
        const endISO = toISODate(weekEnd);

        const [entries, clocks, sessions, coverHours] = await Promise.all([
          supabase
            .from("daily_cash_entries")
            .select("entry_date, vita_mojo_sales, supermarket_expenses")
            .eq("store_id", storeId)
            .gte("entry_date", startISO)
            .lte("entry_date", endISO),
          // Estate-wide and NOT store-filtered, deliberately. Cash is owed by the
          // store each SHIFT was worked at, and the home-store NI allowance is a
          // rule over the employee's whole week — both need every row. Reading
          // employee_hours_computed.cash_amount_due instead billed a split week's
          // cash wholly to the home store and NI-limited the away hours, which is
          // the bug Update 218 fixed everywhere else (Update 225).
          supabase
            .from("clock_events")
            .select(CLOCK_COLUMNS)
            .gte("event_date", startISO)
            .lte("event_date", endISO),
          supabase
            .from("clock_sessions")
            .select(PAY_CLOCK_SESSION_COLUMNS)
            .gte("event_date", startISO)
            .lte("event_date", endISO),
          // Cover drivers are keyed per DAY, not per week, and only approved
          // days represent money actually owed.
          supabase
            .from("cover_driver_hours_computed")
            .select("total_pay")
            .eq("store_id", storeId)
            .eq("approved", true)
            .gte("work_date", startISO)
            .lte("work_date", endISO),
        ]);

        if (!active) return;

        const days = eachDay(weekStart, weekEnd).map((d, i): DailyRow => ({
          date: toISODate(d),
          day: WEEKDAY_SHORT[i],
          sales: 0,
          expenses: 0,
        }));

        for (const e of entries.data ?? []) {
          const idx = days.findIndex((x) => x.date === e.entry_date);
          if (idx >= 0) {
            days[idx].sales += Number(e.vita_mojo_sales || 0);
            days[idx].expenses += Number(e.supermarket_expenses || 0);
          }
        }
        setDaily(days);

        const hoursByEmpStore = approvedHoursByEmployeeStore(
          (clocks.data ?? []) as unknown as StoreClockRow[],
          (sessions.data ?? []) as unknown as StoreClockSessionRow[],
        );
        setEmpPay(
          employees
            .map((emp): EmpPay => {
              const hoursHere = hoursByEmpStore.get(`${emp.id}:${storeId}`) ?? 0;
              const cashHours = cashHoursFromStoreTotal(hoursHere, storeId, emp);
              return {
                employee_id: emp.id,
                employee_name: emp.name,
                cash_hours: cashHours,
                cash_amount_due: round2(cashHours * (Number(emp.hourly_cash_rate) || 0)),
                total_hours_worked: hoursHere,
              };
            })
            .filter((r) => r.total_hours_worked > 0),
        );
        setCoverPay((coverHours.data ?? []) as unknown as Array<{ total_pay: number }>);
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
  }, [supabase, weekStart, weekEnd, storeId, empKey]);

  const isCurrent = isSameDay(weekStart, startOfISOWeek(new Date()));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted font-medium">
              Selected Week
            </p>
            <p className="text-lg font-semibold mt-1">{weekLabel(weekStart)}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto [&>button:nth-child(2)]:flex-1 sm:[&>button:nth-child(2)]:flex-none">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              aria-label="Previous week"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart(startOfISOWeek(new Date()))}
              disabled={isCurrent}
            >
              This week
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              aria-label="Next week"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          <>
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
          </>
        ) : (
          <>
            <StatTile label="Total Sales" value={totals.sales} tone="gold" />
            <StatTile label="Total Expenses" value={totals.exp} />
            <StatTile
              label={totals.coverCash > 0 ? "Cash Pay (incl. cover)" : "Employee Cash Pay"}
              value={totals.cashPay}
              tone="danger"
            />
            <StatTile
              label="Net Cash Flow"
              value={totals.net}
              tone={totals.net >= 0 ? "success" : "danger"}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Sales vs Expenses</CardTitle>
          <CardDescription>Bars in £</CardDescription>
        </CardHeader>

        {loading ? (
          <Skeleton className="h-[280px]" />
        ) : daily.every((d) => d.sales === 0 && d.expenses === 0) ? (
          <EmptyState
            icon={<ChartIcon />}
            title="No data this week"
            description="Once cash entries are logged, you'll see daily totals here."
          />
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `£${v}`}
                  width={70}
                />
                <Tooltip
                  formatter={(v: number) => formatINR(v)}
                  cursor={{ fill: colors.cursorFill }}
                />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill={colors.gold} radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={colors.danger} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee Cash Payments</CardTitle>
          <CardDescription>
            Hours worked at this store · home-store hours over the weekly bank limit
            are cash, hours covered away are cash in full · week of{" "}
            {formatDDMMYYYY(weekStart)}
          </CardDescription>
        </CardHeader>

        {loading ? (
          <Skeleton className="h-[120px]" />
        ) : empPay.length === 0 || empPay.every((p) => Number(p.cash_amount_due) === 0) ? (
          <EmptyState
            icon={<ChartIcon />}
            title="No cash payments due"
            description="No employee has logged more than 20 hours this week yet."
          />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Hrs here</th>
                  <th className="px-3 py-2 font-medium text-right">Cash hrs</th>
                  <th className="px-3 py-2 font-medium text-right">Cash due</th>
                </tr>
              </thead>
              <tbody>
                {empPay
                  .filter((p) => Number(p.cash_amount_due) > 0)
                  .map((p, i) => (
                    <tr
                      key={p.employee_id}
                      className={`${i % 2 === 0 ? "" : "bg-bg/50"} border-t border-border/60`}
                    >
                      <td className="px-3 py-3" data-label="">{p.employee_name}</td>
                      <td className="px-3 py-3 text-right tabular-nums" data-label="Hrs here">
                        <HoursMinsDisplay hours={Number(p.total_hours_worked)} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" data-label="Cash hrs">
                        <HoursMinsDisplay hours={Number(p.cash_hours)} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-gold" data-label="Cash due">
                        {formatINR(Number(p.cash_amount_due))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
