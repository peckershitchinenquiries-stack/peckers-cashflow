"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ShiftEditModal } from "./ShiftEditModal";
import { DeliveryEditModal } from "./DeliveryEditModal";
import {
  WEEKDAY_SHORT,
  addDays,
  eachDay,
  formatGBP,
  formatShiftRange,
  parseISODate,
  startOfISOWeek,
  toISODate,
  todayISO,
  weekdayIndex,
} from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "@/components/ui/icons";
import { applyScheduleToWeek } from "@/app/actions/schedule";
import { wageComplianceForEmployee } from "@/lib/compliance";
import { DEFAULT_SETTINGS, type MinWageBands } from "@/lib/settings";
import type {
  ClockEvent,
  Employee,
  EmployeeScheduleDay,
  RotaShift,
  Store,
  WeeklyDelivery,
} from "@/lib/types";

type Props = {
  stores: Store[];
  employees: Employee[];
  shifts: RotaShift[];
  clocks: ClockEvent[];
  weeklyDeliveries: WeeklyDelivery[];
  schedules?: EmployeeScheduleDay[];
  minWageBands?: MinWageBands;
  rangeStartIso: string;
  rangeEndIso: string;
  userRole: string;
  userStoreId: string | null;
};

export function RotaView({
  stores,
  employees,
  shifts,
  clocks,
  weeklyDeliveries,
  schedules = [],
  minWageBands = DEFAULT_SETTINGS.min_wage_bands,
  rangeStartIso,
  rangeEndIso,
  userRole,
  userStoreId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const rangeStart = React.useMemo(() => parseISODate(rangeStartIso), [rangeStartIso]);
  const rangeEnd = React.useMemo(() => parseISODate(rangeEndIso), [rangeEndIso]);
  // ISO week anchoring the range start — used for weekly deliveries & "apply
  // defaults", both of which remain week-based concepts.
  const weekStart = React.useMemo(() => startOfISOWeek(rangeStart), [rangeStart]);
  const [applying, setApplying] = React.useState(false);
  const [activeStoreId, setActiveStoreId] = React.useState<string>(
    userStoreId && stores.some((s) => s.id === userStoreId)
      ? userStoreId
      : stores[0]?.id ?? "",
  );
  const [editingShift, setEditingShift] = React.useState<{
    employee: Employee;
    date: string;
    existing: RotaShift | null;
    prefill: { start: string; end: string } | null;
  } | null>(null);
  const [editingDelivery, setEditingDelivery] = React.useState<{
    driver: Employee;
    existing: WeeklyDelivery | null;
    weekDays: string[];
    events: ClockEvent[];
  } | null>(null);

  const isSuperAdmin = userRole === "admin";
  const activeStore = stores.find((s) => s.id === activeStoreId);
  // Every day in the selected range (kept as `weekDays` for the rest of the
  // component, but it can now span any number of days).
  const weekDays = React.useMemo(
    () => eachDay(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );
  const rangeDayCount = weekDays.length;

  // Employees for current store
  const storeEmployees = employees.filter(
    (e) => e.store_id === activeStoreId && e.employment_status === "active",
  );

  // Index shifts: key = `${employee_id}:${shift_date}`
  const shiftByKey = React.useMemo(() => {
    const m = new Map<string, RotaShift>();
    for (const s of shifts) m.set(`${s.employee_id}:${s.shift_date}`, s);
    return m;
  }, [shifts]);

  // Clocks indexed by employee+date
  const clockByKey = React.useMemo(() => {
    const m = new Map<string, ClockEvent>();
    for (const c of clocks) m.set(`${c.employee_id}:${c.event_date}`, c);
    return m;
  }, [clocks]);

  // Deliveries indexed by driver
  const deliveryByDriver = React.useMemo(() => {
    const m = new Map<string, WeeklyDelivery>();
    for (const d of weeklyDeliveries) m.set(d.driver_id, d);
    return m;
  }, [weeklyDeliveries]);

  // Recurring schedule template indexed by employee + weekday (0=Mon..6=Sun).
  const scheduleByEmpDay = React.useMemo(() => {
    const m = new Map<string, EmployeeScheduleDay>();
    for (const s of schedules) m.set(`${s.employee_id}:${s.weekday}`, s);
    return m;
  }, [schedules]);

  // Live deliveries logged at clock-out, summed per driver for the shown week.
  const liveDeliveriesByEmp = React.useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => toISODate(d)));
    const m = new Map<string, number>();
    for (const c of clocks) {
      if (c.deliveries_count == null) continue;
      if (!weekSet.has(c.event_date)) continue;
      m.set(c.employee_id, (m.get(c.employee_id) ?? 0) + Number(c.deliveries_count));
    }
    return m;
  }, [clocks, weekDays]);

  // Extra deliveries (beyond the normal round) summed per driver for the week.
  const liveExtraByEmp = React.useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => toISODate(d)));
    const m = new Map<string, number>();
    for (const c of clocks) {
      if (!c.extra_deliveries) continue;
      if (!weekSet.has(c.event_date)) continue;
      m.set(c.employee_id, (m.get(c.employee_id) ?? 0) + Number(c.extra_deliveries));
    }
    return m;
  }, [clocks, weekDays]);

  // 4-week rolling avg per employee (across all stores) using prior weeks
  const fourWkAvg = React.useMemo(() => {
    const result = new Map<string, number>();
    for (const emp of employees) {
      const empShifts = shifts.filter(
        (s) => s.employee_id === emp.id && !s.is_day_off,
      );
      const byWeek = new Map<string, number>();
      for (const s of empShifts) {
        const wk = toISODate(startOfISOWeek(new Date(s.shift_date)));
        byWeek.set(wk, (byWeek.get(wk) ?? 0) + Number(s.scheduled_hours ?? 0));
      }
      const current = toISODate(weekStart);
      const prior = Array.from(byWeek.entries())
        .filter(([wk]) => wk !== current)
        .slice(-4)
        .map(([, h]) => h);
      const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
      result.set(emp.id, avg);
    }
    return result;
  }, [shifts, employees, weekStart]);

  // Navigate by pushing the range to the URL; the server page re-fetches the
  // shifts/clocks for whatever range is requested.
  function setRange(startIso: string, endIso: string) {
    router.push(`${pathname}?start=${startIso}&end=${endIso}`);
  }

  // Step the whole window forward/backward by its own length, so paging keeps
  // showing the same number of days.
  function shiftRange(direction: number) {
    const step = direction * rangeDayCount;
    setRange(
      toISODate(addDays(rangeStart, step)),
      toISODate(addDays(rangeEnd, step)),
    );
  }

  function goToday() {
    const ws = startOfISOWeek(new Date());
    setRange(toISODate(ws), toISODate(addDays(ws, 6)));
  }

  // Generate this week's shifts from each employee's recurring schedule.
  // Only fills empty cells (existing shifts are kept).
  async function applyDefaults() {
    setApplying(true);
    try {
      const res = await applyScheduleToWeek({
        store_id: activeStoreId,
        week_start: toISODate(weekStart),
        overwrite: false,
      });
      const parts: string[] = [];
      if (res.created) parts.push(`${res.created} added`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.skipped) parts.push(`${res.skipped} kept`);
      toast.success(
        parts.length
          ? `Schedule applied — ${parts.join(", ")}`
          : "No schedule templates set for this store yet",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setApplying(false);
    }
  }

  function weekTotalHours(empId: string): number {
    return weekDays.reduce((sum, d) => {
      const s = shiftByKey.get(`${empId}:${toISODate(d)}`);
      if (!s || s.is_day_off) return sum;
      return sum + Number(s.scheduled_hours ?? 0);
    }, 0);
  }

  // Scheduled hours within the range, grouped by ISO week. The NI/cash split
  // (first 20h NI, remainder cash) is a weekly rule, so for multi-week ranges
  // we apply the 20h threshold per week rather than across the whole range.
  function hoursByWeek(empId: string): number[] {
    const byWeek = new Map<string, number>();
    for (const d of weekDays) {
      const s = shiftByKey.get(`${empId}:${toISODate(d)}`);
      if (!s || s.is_day_off) continue;
      const wk = toISODate(startOfISOWeek(d));
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + Number(s.scheduled_hours ?? 0));
    }
    return Array.from(byWeek.values());
  }

  // Cash hours = sum of hours above 20 in each week of the range.
  function weekCashHours(empId: string): number {
    return hoursByWeek(empId).reduce((sum, h) => sum + Math.max(h - 20, 0), 0);
  }

  function weekWages(emp: Employee): { ni: number; cash: number; total: number } {
    const niRate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);
    const cashRate = Number(emp.hourly_cash_rate ?? 0);
    let niHours = 0;
    let cashHours = 0;
    for (const h of hoursByWeek(emp.id)) {
      niHours += Math.min(h, 20);
      cashHours += Math.max(h - 20, 0);
    }
    const ni = niHours * niRate;
    const cash = cashHours * cashRate;
    return { ni, cash, total: ni + cash };
  }

  const expectedWageBill = storeEmployees.reduce(
    (sum, e) => sum + weekWages(e).total,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Store tabs & week nav */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-2 flex-wrap items-center">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => setActiveStoreId(store.id)}
                disabled={!isSuperAdmin && userStoreId !== null && userStoreId !== store.id}
                className={
                  "px-4 h-10 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
                  (store.id === activeStoreId
                    ? "bg-gold text-black border-gold"
                    : "bg-surface text-text-primary border-border hover:bg-surface-hover")
                }
              >
                {store.name}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={applyDefaults}
              loading={applying}
              title="Fill this week's empty days from each employee's recurring weekly schedule"
            >
              Apply default schedules
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftRange(-1)}
              iconLeft={<ChevronLeftIcon size={14} />}
              title={`Back ${rangeDayCount} day${rangeDayCount === 1 ? "" : "s"}`}
            >
              Prev
            </Button>
            <DateRangePicker
              start={rangeStartIso}
              end={rangeEndIso}
              onApply={setRange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftRange(1)}
              iconRight={<ChevronRightIcon size={14} />}
              title={`Forward ${rangeDayCount} day${rangeDayCount === 1 ? "" : "s"}`}
            >
              Next
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday}>
              Today
            </Button>
          </div>
        </div>
      </Card>

      {/* Rota grid */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="px-5 pt-5">
          <div>
            <CardTitle>{activeStore?.name ?? "—"} Rota</CardTitle>
            <CardDescription>
              {storeEmployees.length} active staff · Expected wage bill{" "}
              <span className="text-text-primary font-medium">
                {formatGBP(expectedWageBill)}
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-surface-hover z-10">
                  Employee
                </th>
                <th className="text-left px-2 py-2">Position</th>
                <th className="text-right px-2 py-2">NI £/h</th>
                <th className="text-right px-2 py-2">Cash £/h</th>
                {weekDays.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="text-center px-2 py-2 min-w-[110px]"
                  >
                    <div>{WEEKDAY_SHORT[(d.getDay() + 6) % 7]}</div>
                    <div className="text-[10px] font-normal text-text-muted normal-case">
                      {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                    </div>
                  </th>
                ))}
                <th className="text-right px-2 py-2">Total hrs</th>
                <th className="text-right px-2 py-2" title="Hours above 20/week are paid in cash">
                  Cash hrs
                </th>
                <th className="text-right px-2 py-2">4-wk avg</th>
                <th className="text-right px-3 py-2 group relative">
                  Wages
                  <InfoIcon size={11} className="inline ml-1 opacity-60" />
                </th>
                <th className="text-center px-2 py-2">Deliveries</th>
              </tr>
            </thead>
            <tbody>
              {storeEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={16}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    No active employees assigned to this store. Add staff in
                    Employees and assign them to this location.
                  </td>
                </tr>
              )}
              {storeEmployees.map((emp) => {
                const total = weekTotalHours(emp.id);
                const cashHrs = weekCashHours(emp.id);
                const avg = fourWkAvg.get(emp.id) ?? 0;
                const wages = weekWages(emp);
                const variance =
                  avg > 0 ? ((total - avg) / avg) * 100 : 0;
                const flagVariance = avg > 0 && Math.abs(variance) > 20;
                const isDriver = emp.position === "Driver";
                const delivery = deliveryByDriver.get(emp.id);
                const wage = wageComplianceForEmployee(emp, minWageBands);
                const underMinWage = wage ? !wage.compliant : false;
                const liveDeliv = liveDeliveriesByEmp.get(emp.id) ?? 0;
                const liveExtra = liveExtraByEmp.get(emp.id) ?? 0;

                return (
                  <tr
                    key={emp.id}
                    className="border-t border-border hover:bg-surface-hover/60 transition-colors"
                  >
                    <td className="px-3 py-2 sticky left-0 bg-surface z-10 font-medium text-text-primary">
                      {emp.name}
                    </td>
                    <td className="px-2 py-2 text-text-subtle">
                      {emp.position ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-text-subtle">
                      <span className={underMinWage ? "text-danger font-medium" : ""}>
                        £{Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0).toFixed(2)}
                      </span>
                      {underMinWage && wage && (
                        <span
                          className="block text-[9px] text-danger"
                          title={`Below minimum wage for age ${wage.age}: needs £${wage.required.toFixed(2)}/h (${minWageBands.effective_label})`}
                        >
                          ⚠ below min
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-text-subtle">
                      {emp.hourly_cash_rate
                        ? `£${Number(emp.hourly_cash_rate).toFixed(2)}`
                        : "—"}
                    </td>
                    {weekDays.map((d) => {
                      const dateIso = toISODate(d);
                      const cell = shiftByKey.get(`${emp.id}:${dateIso}`);
                      const clk = clockByKey.get(`${emp.id}:${dateIso}`);
                      const isToday = dateIso === todayISO();
                      // Ghost hint: the employee's recurring schedule for this
                      // weekday, shown faintly in empty cells as a suggestion.
                      const tmpl = scheduleByEmpDay.get(
                        `${emp.id}:${weekdayIndex(d)}`,
                      );
                      const ghost =
                        !cell && tmpl && tmpl.is_working && tmpl.start_time
                          ? `${tmpl.start_time.slice(0, 5)}–${(tmpl.end_time ?? "").slice(0, 5)}`
                          : null;
                      // Previous day's shift — used to pre-fill a new shift.
                      const prevShift = shiftByKey.get(
                        `${emp.id}:${toISODate(addDays(d, -1))}`,
                      );
                      const prefill =
                        !cell && prevShift && !prevShift.is_day_off && prevShift.start_time
                          ? {
                              start: prevShift.start_time.slice(0, 5),
                              end: (prevShift.end_time ?? "").slice(0, 5),
                            }
                          : null;
                      return (
                        <td
                          key={dateIso}
                          className={
                            "px-1 py-1 text-center align-middle " +
                            (isToday ? "bg-gold/5" : "")
                          }
                        >
                          <button
                            onClick={() =>
                              setEditingShift({
                                employee: emp,
                                date: dateIso,
                                existing: cell ?? null,
                                prefill,
                              })
                            }
                            className={
                              "w-full h-12 rounded-lg text-xs border transition-colors " +
                              (cell?.is_day_off
                                ? "bg-danger/10 border-danger/30 text-danger"
                                : cell?.start_time
                                  ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
                                  : ghost
                                    ? "border-dashed border-gold/30 text-text-muted hover:bg-gold/5"
                                    : "border-dashed border-border text-text-muted hover:bg-surface-hover")
                            }
                            title={
                              cell?.same_day_edit_reason
                                ? `Reason: ${cell.same_day_edit_reason}`
                                : ghost
                                  ? "Default from recurring schedule — click to add this shift"
                                  : undefined
                            }
                          >
                            {cell ? (
                              formatShiftRange(
                                cell.is_day_off,
                                cell.start_time,
                                cell.end_time,
                              )
                            ) : ghost ? (
                              <span className="opacity-60">
                                {ghost}
                                <span className="block text-[9px] uppercase tracking-wide">
                                  default
                                </span>
                              </span>
                            ) : (
                              "—"
                            )}
                            {clk?.clock_in_at && (
                              <div className="text-[9px] text-text-muted mt-0.5">
                                in {new Date(clk.clock_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right font-medium">
                      {total.toFixed(1)}h
                    </td>
                    <td className="px-2 py-2 text-right">
                      {cashHrs > 0 ? (
                        <span className="font-medium text-gold">
                          {cashHrs.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-text-subtle">
                      <span className={flagVariance ? "text-warning" : ""}>
                        {avg.toFixed(1)}h
                        {flagVariance && (
                          <span className="ml-1 text-[10px]">
                            ({variance > 0 ? "+" : ""}
                            {variance.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-medium text-text-primary">
                        {formatGBP(wages.total)}
                      </div>
                      <div className="text-[10px] text-text-muted leading-tight mt-0.5">
                        <span>NI {formatGBP(wages.ni)}</span>
                        {wages.cash > 0 && (
                          <span className="block text-success">Cash {formatGBP(wages.cash)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs">
                      {isDriver ? (
                        <button
                          onClick={() =>
                            setEditingDelivery({
                              driver: emp,
                              existing: delivery ?? null,
                              weekDays: weekDays.map((d) => toISODate(d)),
                              events: clocks.filter(
                                (c) =>
                                  c.employee_id === emp.id &&
                                  weekDays.some((d) => toISODate(d) === c.event_date),
                              ),
                            })
                          }
                          className="text-text-subtle hover:text-text-primary underline-offset-2 hover:underline"
                        >
                          {delivery?.manager_avg_4wk != null
                            ? `Avg ${delivery.manager_avg_4wk}`
                            : "Enter"}
                          {delivery?.vita_mojo_count != null && (
                            <span className="block text-[10px] text-text-muted">
                              Vita {delivery.vita_mojo_count}
                            </span>
                          )}
                          <span
                            className="block text-[10px] text-success"
                            title="Deliveries logged via clock-out this week"
                          >
                            Live {liveDeliv}
                            {liveExtra > 0 && (
                              <span className="text-gold"> (+{liveExtra} extra)</span>
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      {editingShift && (
        <ShiftEditModal
          employee={editingShift.employee}
          storeId={activeStoreId}
          shiftDate={editingShift.date}
          existing={editingShift.existing}
          prefill={editingShift.prefill}
          onClose={() => setEditingShift(null)}
          onSaved={() => {
            setEditingShift(null);
            toast.success("Shift updated");
            router.refresh();
          }}
        />
      )}
      {editingDelivery && (
        <DeliveryEditModal
          driver={editingDelivery.driver}
          storeId={activeStoreId}
          weekStartIso={toISODate(weekStart)}
          existing={editingDelivery.existing}
          weekDays={editingDelivery.weekDays}
          events={editingDelivery.events}
          onClose={() => setEditingDelivery(null)}
          onSaved={() => {
            setEditingDelivery(null);
            toast.success("Deliveries saved");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
