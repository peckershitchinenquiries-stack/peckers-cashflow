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
import type { RotaShift } from "@/lib/types";

export const dynamic = "force-dynamic";

function WeekBlock({
  weekStart,
  shifts,
}: {
  weekStart: Date;
  shifts: RotaShift[];
}) {
  const today = todayISO();
  const byDate = new Map(shifts.map((s) => [s.shift_date, s]));
  const total = shifts.reduce(
    (sum, s) => (s.is_day_off ? sum : sum + shiftHours(s.start_time, s.end_time)),
    0,
  );

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="px-5 pt-5 flex-row items-center justify-between">
        <CardTitle>{weekLabel(weekStart)}</CardTitle>
        <Badge variant="gold">{total.toFixed(1)}h</Badge>
      </CardHeader>
      <div className="border-t border-border">
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(weekStart, i);
          const iso = toISODate(date);
          const shift = byDate.get(iso);
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={
                "px-5 py-3 border-b border-border last:border-0 flex items-center justify-between " +
                (isToday ? "bg-gold/5" : "")
              }
            >
              <div className="text-sm font-medium">
                {WEEKDAY_LONG[i]}{" "}
                <span className="text-text-muted text-xs ml-1">
                  {formatDDMMYYYY(date)}
                </span>
              </div>
              <div className="text-sm text-text-subtle">
                {shift ? (
                  shift.is_day_off ? (
                    <span className="text-danger">Day Off</span>
                  ) : (
                    <>
                      {formatShiftRange(false, shift.start_time, shift.end_time)}
                      {shift.same_day_edit_reason && (
                        <span className="block text-[10px] text-warning mt-0.5">
                          {shift.same_day_edit_reason}
                        </span>
                      )}
                    </>
                  )
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

  const shifts = employee
    ? ((
        await supabase
          .from("rota_shifts")
          .select("*")
          .eq("employee_id", employee.id)
          .gte("shift_date", rangeStart)
          .lte("shift_date", rangeEnd)
          .order("shift_date")
      ).data ?? [])
    : [];

  const thisWeekShifts = (shifts as RotaShift[]).filter(
    (s) => s.shift_date < toISODate(nextWeek),
  );
  const nextWeekShifts = (shifts as RotaShift[]).filter(
    (s) => s.shift_date >= toISODate(nextWeek),
  );

  return (
    <>
      <PageHeader
        title="My Shifts"
        description="Your upcoming rota. Updates automatically when your manager makes changes."
      />
      <div className="flex flex-col gap-5">
        <WeekBlock weekStart={thisWeek} shifts={thisWeekShifts} />
        <WeekBlock weekStart={nextWeek} shifts={nextWeekShifts} />
      </div>
    </>
  );
}
