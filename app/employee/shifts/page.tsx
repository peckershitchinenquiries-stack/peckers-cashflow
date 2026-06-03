import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import {
  WEEKDAY_LONG,
  addDays,
  formatDDMMYYYY,
  formatShiftRange,
  shiftHours,
  startOfISOWeek,
  toISODate,
  todayISO,
  weekLabel,
} from "@/lib/utils";
import type { EmployeeScheduleDay, RotaShift } from "@/lib/types";

export const dynamic = "force-dynamic";

function WeekBlock({
  weekStart,
  shifts,
  schedules,
}: {
  weekStart: Date;
  shifts: RotaShift[];
  schedules: EmployeeScheduleDay[];
}) {
  const today = todayISO();
  const byDate = new Map(shifts.map((s) => [s.shift_date, s]));
  const tmplByWeekday = new Map(schedules.map((s) => [s.weekday, s]));

  // Resolve each day: published rota row first, else the recurring template.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const iso = toISODate(date);
    const shift = byDate.get(iso);
    if (shift) {
      return {
        iso,
        date,
        label: WEEKDAY_LONG[i],
        kind: shift.is_day_off ? ("off" as const) : ("shift" as const),
        start: shift.start_time,
        end: shift.end_time,
        reason: shift.same_day_edit_reason,
        hours: shift.is_day_off ? 0 : shiftHours(shift.start_time, shift.end_time),
      };
    }
    const tmpl = tmplByWeekday.get(i);
    if (tmpl && tmpl.is_working && tmpl.start_time) {
      return {
        iso,
        date,
        label: WEEKDAY_LONG[i],
        kind: "default" as const,
        start: tmpl.start_time,
        end: tmpl.end_time,
        reason: null,
        hours: shiftHours(tmpl.start_time, tmpl.end_time),
      };
    }
    return {
      iso,
      date,
      label: WEEKDAY_LONG[i],
      kind: "none" as const,
      start: null,
      end: null,
      reason: null,
      hours: 0,
    };
  });

  const total = days.reduce((sum, d) => sum + d.hours, 0);

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="px-5 pt-5 flex-row items-center justify-between">
        <CardTitle>{weekLabel(weekStart)}</CardTitle>
        <Badge variant="gold">{total.toFixed(1)}h</Badge>
      </CardHeader>
      <div className="border-t border-border">
        {days.map((d) => {
          const isToday = d.iso === today;
          return (
            <div
              key={d.iso}
              className={
                "px-5 py-3 border-b border-border last:border-0 flex items-center justify-between " +
                (isToday ? "bg-gold/5" : "")
              }
            >
              <div className="text-sm font-medium">
                {d.label}{" "}
                <span className="text-text-muted text-xs ml-1">
                  {formatDDMMYYYY(d.date)}
                </span>
              </div>
              <div className="text-sm text-text-subtle text-right">
                {d.kind === "off" ? (
                  <span className="text-danger">Day Off</span>
                ) : d.kind === "shift" ? (
                  <>
                    {formatShiftRange(false, d.start, d.end)}
                    {d.reason && (
                      <span className="block text-[10px] text-warning mt-0.5">
                        {d.reason}
                      </span>
                    )}
                  </>
                ) : d.kind === "default" ? (
                  <>
                    {formatShiftRange(false, d.start, d.end)}
                    <span className="block text-[10px] text-text-muted mt-0.5">
                      default schedule
                    </span>
                  </>
                ) : (
                  <span className="text-text-muted">No shift</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default async function ShiftsPage() {
  const user = await requireRole(["employee"]);
  const supabase = createServerSupabase();

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email.toLowerCase()}`)
    .limit(1)
    .maybeSingle();

  const thisWeek = startOfISOWeek(new Date());
  const nextWeek = addDays(thisWeek, 7);
  const rangeStart = toISODate(thisWeek);
  const rangeEnd = toISODate(addDays(nextWeek, 6));

  const [shiftsData, schedulesData] = employee
    ? await Promise.all([
        supabase
          .from("rota_shifts")
          .select("*")
          .eq("employee_id", employee.id)
          .gte("shift_date", rangeStart)
          .lte("shift_date", rangeEnd)
          .order("shift_date"),
        supabase
          .from("employee_schedules")
          .select("*")
          .eq("employee_id", employee.id),
      ])
    : [{ data: [] }, { data: [] }];

  const shifts = (shiftsData.data ?? []) as RotaShift[];
  const schedules = (schedulesData.data ?? []) as EmployeeScheduleDay[];

  const thisWeekShifts = shifts.filter((s) => s.shift_date < toISODate(nextWeek));
  const nextWeekShifts = shifts.filter((s) => s.shift_date >= toISODate(nextWeek));

  return (
    <>
      <PageHeader
        title="My Shifts"
        description="Your upcoming rota. Days shown as “default schedule” come from your standard weekly pattern until the manager publishes the rota."
      />
      <div className="flex flex-col gap-5">
        <WeekBlock weekStart={thisWeek} shifts={thisWeekShifts} schedules={schedules} />
        <WeekBlock weekStart={nextWeek} shifts={nextWeekShifts} schedules={schedules} />
      </div>
    </>
  );
}
