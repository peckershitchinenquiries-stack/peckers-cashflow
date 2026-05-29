"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ShiftEditModal } from "./ShiftEditModal";
import { DeliveryEditModal } from "./DeliveryEditModal";
import {
  WEEKDAY_SHORT,
  addDays,
  formatDDMMYYYY,
  formatGBP,
  formatShiftRange,
  parseISODate,
  shiftHours,
  startOfISOWeek,
  toISODate,
  todayISO,
} from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "@/components/ui/icons";
import type {
  ClockEvent,
  Employee,
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
  weekStartIso: string;
  userRole: string;
  userStoreId: string | null;
};

export function RotaView({
  stores,
  employees,
  shifts,
  clocks,
  weeklyDeliveries,
  weekStartIso,
  userRole,
  userStoreId,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [weekStart, setWeekStart] = React.useState(parseISODate(weekStartIso));
  const [activeStoreId, setActiveStoreId] = React.useState<string>(
    userStoreId && stores.some((s) => s.id === userStoreId)
      ? userStoreId
      : stores[0]?.id ?? "",
  );
  const [editingShift, setEditingShift] = React.useState<{
    employee: Employee;
    date: string;
    existing: RotaShift | null;
  } | null>(null);
  const [editingDelivery, setEditingDelivery] = React.useState<{
    driver: Employee;
    existing: WeeklyDelivery | null;
  } | null>(null);

  const isSuperAdmin = userRole === "admin";
  const activeStore = stores.find((s) => s.id === activeStoreId);
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

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

  function shiftWeek(delta: number) {
    setWeekStart((w) => addDays(w, delta * 7));
    // Note: this client-side shift; data is already loaded for prior 4 weeks
    // For a full reload to another week, we'd hit the server. Refresh is fine.
    router.refresh();
  }

  function weekTotalHours(empId: string): number {
    return weekDays.reduce((sum, d) => {
      const s = shiftByKey.get(`${empId}:${toISODate(d)}`);
      if (!s || s.is_day_off) return sum;
      return sum + Number(s.scheduled_hours ?? 0);
    }, 0);
  }

  function weekWages(emp: Employee): { ni: number; cash: number; total: number } {
    const hours = weekTotalHours(emp.id);
    const niHours = Math.min(hours, 20);
    const cashHours = Math.max(hours - 20, 0);
    const niRate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);
    const cashRate = Number(emp.hourly_cash_rate ?? 0);
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
          <div className="flex gap-2 flex-wrap">
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
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftWeek(-1)}
              iconLeft={<ChevronLeftIcon size={14} />}
            >
              Prev
            </Button>
            <div className="text-sm text-text-subtle text-center min-w-[180px]">
              <div className="text-xs text-text-muted uppercase tracking-wider">
                Week
              </div>
              <div className="font-medium">
                {formatDDMMYYYY(weekDays[0])} – {formatDDMMYYYY(weekDays[6])}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftWeek(1)}
              iconRight={<ChevronRightIcon size={14} />}
            >
              Next
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWeekStart(startOfISOWeek(new Date()));
                router.refresh();
              }}
            >
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
                    colSpan={13}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    No active employees assigned to this store. Add staff in
                    Employees and assign them to this location.
                  </td>
                </tr>
              )}
              {storeEmployees.map((emp) => {
                const total = weekTotalHours(emp.id);
                const avg = fourWkAvg.get(emp.id) ?? 0;
                const wages = weekWages(emp);
                const variance =
                  avg > 0 ? ((total - avg) / avg) * 100 : 0;
                const flagVariance = avg > 0 && Math.abs(variance) > 20;
                const isDriver = emp.position === "Driver";
                const delivery = deliveryByDriver.get(emp.id);

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
                      £{Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0).toFixed(2)}
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
                              })
                            }
                            className={
                              "w-full h-12 rounded-lg text-xs border transition-colors " +
                              (cell?.is_day_off
                                ? "bg-danger/10 border-danger/30 text-danger"
                                : cell?.start_time
                                  ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
                                  : "border-dashed border-border text-text-muted hover:bg-surface-hover")
                            }
                            title={
                              cell?.same_day_edit_reason
                                ? `Reason: ${cell.same_day_edit_reason}`
                                : undefined
                            }
                          >
                            {formatShiftRange(
                              cell?.is_day_off ?? false,
                              cell?.start_time ?? null,
                              cell?.end_time ?? null,
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
                      <div
                        className="font-medium text-text-primary group relative inline-block cursor-help"
                        title={`NI: ${formatGBP(wages.ni)}  ·  Cash: ${formatGBP(wages.cash)}`}
                      >
                        {formatGBP(wages.total)}
                        <span className="hidden group-hover:flex absolute right-0 top-full mt-1 z-20 flex-col gap-1 bg-surface border border-border rounded-lg p-2 shadow-xl text-xs text-text-subtle whitespace-nowrap">
                          <span>NI: {formatGBP(wages.ni)}</span>
                          <span>Cash: {formatGBP(wages.cash)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs">
                      {isDriver ? (
                        <button
                          onClick={() =>
                            setEditingDelivery({
                              driver: emp,
                              existing: delivery ?? null,
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
