"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  WEEKDAY_LONG,
  formatDDMMYYYY,
  formatGBP,
  formatShiftRange,
  formatTimeOnly,
  shiftHours,
  todayISO,
} from "@/lib/utils";
import type {
  ClockEvent,
  Employee,
  EmployeeScheduleDay,
  LiveDashboardStatus,
  RotaShift,
  Store,
} from "@/lib/types";

type Props = {
  stores: Store[];
  employees: Employee[];
  shifts: RotaShift[];
  clocks: ClockEvent[];
  /** Recurring weekly templates — used as the fallback "expected" shift when no
   *  rota row is published for today (so missed shifts still show). */
  schedules?: EmployeeScheduleDay[];
  userRole: string;
  userStoreId: string | null;
};

/** Minimal shape the dashboard needs from a shift (real or template-derived). */
type EffShift = {
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
};

const STATUS_STYLES: Record<LiveDashboardStatus, { label: string; cls: string }> = {
  on_shift: { label: "On Shift", cls: "bg-success/15 text-success border-success/40" },
  expected: { label: "Expected", cls: "bg-warning/15 text-warning border-warning/40" },
  late: { label: "Late", cls: "bg-warning/30 text-warning border-warning/60" },
  clocked_out: {
    label: "Clocked Out",
    cls: "bg-surface-hover text-text-subtle border-border",
  },
  day_off: { label: "Day Off", cls: "bg-danger/10 text-danger border-danger/30" },
  tbc: { label: "TBC", cls: "bg-surface-hover text-text-muted border-border" },
  absent: { label: "Absent", cls: "bg-danger/20 text-danger border-danger/60" },
};

const ROW_BG: Record<LiveDashboardStatus, string> = {
  on_shift: "bg-success/5",
  expected: "bg-warning/5",
  late: "bg-warning/10",
  clocked_out: "",
  day_off: "bg-danger/5",
  tbc: "",
  absent: "bg-danger/10",
};

function computeStatus(
  shift: EffShift | null | undefined,
  clock: ClockEvent | null | undefined,
  now: Date,
): LiveDashboardStatus {
  if (!shift) return "tbc";
  if (shift.is_day_off) return "day_off";
  if (clock?.clock_out_at) return "clocked_out";
  if (clock?.clock_in_at) return "on_shift";
  if (!shift.start_time) return "tbc";
  const [h, m] = shift.start_time.split(":").map(Number);
  const sched = new Date(now);
  sched.setHours(h, m, 0, 0);
  const diffMin = (now.getTime() - sched.getTime()) / 60000;
  if (diffMin > 60) return "absent";
  if (diffMin > 15) return "late";
  return "expected";
}

/** Gross hourly rate used to value a day's wage (on-the-books NI rate). */
function rateOf(emp: Employee): number {
  return Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0) || 0;
}

/** Hours actually worked so far today, from the clock event (open shifts count up to now). */
function actualHoursOf(clock: ClockEvent | null | undefined, now: Date): number {
  if (!clock?.clock_in_at) return 0;
  const start = new Date(clock.clock_in_at).getTime();
  const end = clock.clock_out_at ? new Date(clock.clock_out_at).getTime() : now.getTime();
  const ms = end - start;
  return ms > 0 ? ms / 3_600_000 : 0;
}

export function LiveDashboard({
  stores,
  employees,
  shifts,
  clocks,
  schedules = [],
  userRole,
  userStoreId,
}: Props) {
  const router = useRouter();
  const [now, setNow] = React.useState<Date>(() => new Date());

  // Local clock ticks every 30s so the "updated HH:MM" label and time-based
  // statuses (late/absent) stay fresh without hitting the server.
  React.useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Server data refresh runs every 30 seconds, and only while the tab is
  // visible — keeps the board "live" without hammering Supabase on idle tabs.
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), 30_000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [router]);

  const isSuperAdmin = userRole === "admin";

  const visibleStores = stores.filter((s) =>
    isSuperAdmin || !userStoreId ? true : s.id === userStoreId,
  );

  const shiftByEmp = new Map(shifts.map((s) => [s.employee_id, s]));
  const clockByEmp = new Map(clocks.map((c) => [c.employee_id, c]));
  const scheduleByEmpDay = new Map(
    schedules.map((s) => [`${s.employee_id}:${s.weekday}`, s]),
  );
  const todayWeekday = (now.getDay() + 6) % 7;

  // Real published rota row for today, else the recurring template for today's
  // weekday — so an expected shift (and late/absent status) still shows even
  // when the manager hasn't published a rota.
  function effectiveShiftFor(
    empId: string,
  ): { shift: EffShift | null; fromTemplate: boolean } {
    const real = shiftByEmp.get(empId);
    if (real) return { shift: real, fromTemplate: false };
    const tmpl = scheduleByEmpDay.get(`${empId}:${todayWeekday}`);
    if (tmpl && tmpl.is_working && tmpl.start_time) {
      return {
        shift: {
          is_day_off: false,
          start_time: tmpl.start_time,
          end_time: tmpl.end_time,
        },
        fromTemplate: true,
      };
    }
    return { shift: null, fromTemplate: false };
  }

  const today = new Date();
  const weekday = WEEKDAY_LONG[(today.getDay() + 6) % 7];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span>{weekday}, {formatDDMMYYYY(today)}</span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
          Live · updated {formatTimeOnly(now.toISOString())}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {visibleStores.map((store) => {
          const storeEmployees = employees.filter(
            (e) => e.store_id === store.id && e.employment_status === "active",
          );
          // Sort: manager first, then on-shift, then others
          const sorted = [...storeEmployees].sort((a, b) => {
            const pa = a.position === "Manager" ? 0 : 1;
            const pb = b.position === "Manager" ? 0 : 1;
            return pa - pb || a.name.localeCompare(b.name);
          });

          const manager = sorted.find((e) => e.position === "Manager");
          const managerShift = manager ? effectiveShiftFor(manager.id).shift : null;

          const onShiftCount = sorted.filter((e) => {
            const c = clockByEmp.get(e.id);
            return c?.clock_in_at && !c.clock_out_at;
          }).length;

          // Per-employee daily wage: expected (scheduled hours × rate) and
          // actual (hours clocked so far × rate). Drives the table columns and
          // the store totals below.
          const wageRows = sorted.map((emp) => {
            const { shift, fromTemplate } = effectiveShiftFor(emp.id);
            const realShift = shiftByEmp.get(emp.id);
            const clock = clockByEmp.get(emp.id);
            const status = computeStatus(shift, clock, now);
            const rate = rateOf(emp);
            const expHours =
              shift && !shift.is_day_off
                ? realShift && Number(realShift.scheduled_hours) > 0
                  ? Number(realShift.scheduled_hours)
                  : shiftHours(shift.start_time, shift.end_time)
                : 0;
            const actHours = actualHoursOf(clock, now);
            return {
              emp,
              shift,
              fromTemplate,
              clock,
              status,
              expectedWage: expHours * rate,
              actualWage: actHours * rate,
            };
          });
          const expectedTotal = wageRows.reduce((s, r) => s + r.expectedWage, 0);
          const actualTotal = wageRows.reduce((s, r) => s + r.actualWage, 0);

          return (
            <Card key={store.id} className="p-0 overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-border">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold tracking-wide">
                      {store.name}
                    </h2>
                    <p className="text-xs text-text-muted mt-1">
                      {sorted.length} scheduled · {onShiftCount} on shift now
                    </p>
                  </div>
                  {manager && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">
                        Manager on Shift
                      </div>
                      <div className="text-sm font-medium text-text-primary">
                        {manager.name}
                      </div>
                      <div className="text-xs text-text-subtle">
                        {formatShiftRange(
                          managerShift?.is_day_off ?? false,
                          managerShift?.start_time ?? null,
                          managerShift?.end_time ?? null,
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily wage summary — expected (from the schedule) vs actual (clocked so far) */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-surface-hover px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">
                      Expected wage today
                    </div>
                    <div className="text-base font-semibold tabular-nums text-text-primary">
                      {formatGBP(expectedTotal)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-hover px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">
                      Actual wage so far
                    </div>
                    <div className="text-base font-semibold tabular-nums text-gold">
                      {formatGBP(actualTotal)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="text-left px-3 py-2">Employee</th>
                      <th className="text-left px-2 py-2">Role</th>
                      <th className="text-left px-2 py-2">Shift</th>
                      <th className="text-center px-2 py-2">In</th>
                      <th className="text-center px-2 py-2">Out</th>
                      <th className="text-center px-2 py-2">Status</th>
                      <th className="text-right px-2 py-2">Exp. £</th>
                      <th className="text-right px-2 py-2">Act. £</th>
                      <th className="text-center px-2 py-2">Deliv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-center text-text-muted text-sm"
                        >
                          No staff scheduled today. <span className="text-warning">TBC</span>
                        </td>
                      </tr>
                    )}
                    {wageRows.map(({ emp, shift, fromTemplate, clock, status, expectedWage, actualWage }) => {
                      const style = STATUS_STYLES[status];
                      return (
                        <tr
                          key={emp.id}
                          className={
                            "border-t border-border " + (ROW_BG[status] ?? "")
                          }
                        >
                          <td className="px-3 py-2 font-medium text-text-primary">
                            {emp.name}
                          </td>
                          <td className="px-2 py-2 text-text-subtle">
                            {emp.position ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-text-subtle">
                            {formatShiftRange(
                              shift?.is_day_off ?? false,
                              shift?.start_time ?? null,
                              shift?.end_time ?? null,
                            )}
                            {fromTemplate && shift && (
                              <span
                                className="ml-1 text-[9px] uppercase tracking-wide text-text-muted"
                                title="From the employee's recurring schedule (no rota published)"
                              >
                                default
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {formatTimeOnly(clock?.clock_in_at)}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {formatTimeOnly(clock?.clock_out_at)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border " +
                                style.cls
                              }
                            >
                              {style.label}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-xs tabular-nums text-text-subtle">
                            {expectedWage > 0 ? formatGBP(expectedWage) : "—"}
                          </td>
                          <td className="px-2 py-2 text-right text-xs tabular-nums text-text-primary">
                            {actualWage > 0 ? formatGBP(actualWage) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-text-subtle">
                            {emp.position === "Driver"
                              ? clock?.deliveries_count ?? "—"
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="text-xs text-text-muted">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-text-subtle font-medium">Status key:</span>
          {(["on_shift", "expected", "late", "clocked_out", "day_off", "absent", "tbc"] as LiveDashboardStatus[]).map(
            (s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className={
                    "inline-block h-3 w-3 rounded-sm border " + STATUS_STYLES[s].cls
                  }
                />
                {STATUS_STYLES[s].label}
              </span>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}
