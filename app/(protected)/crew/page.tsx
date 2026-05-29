import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { CrewClockApp } from "@/components/crew/CrewClockApp";
import {
  addDays,
  endOfISOWeek,
  startOfISOWeek,
  toISODate,
  todayISO,
} from "@/lib/utils";
import type {
  ClockEvent,
  Employee,
  RotaShift,
  Store,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function CrewPage() {
  const user = await requireUser();
  const supabase = createServerSupabase();

  // Find the employee linked to this auth user (by auth_user_id or email)
  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email.toLowerCase()}`)
    .limit(1)
    .maybeSingle();

  if (!employee) {
    return (
      <>
        <PageHeader
          title="Crew App"
          description="Clock in & out, view your rota."
        />
        <Card>
          <p className="text-sm text-text-muted">
            Your manager hasn&apos;t linked your account to a crew profile yet. Once
            they do, you&apos;ll be able to clock in here.
          </p>
        </Card>
      </>
    );
  }

  const today = todayISO();
  const weekStart = startOfISOWeek(new Date());
  const weekEnd = endOfISOWeek(new Date());

  const [storeRes, shiftsRes, clockRes] = await Promise.all([
    employee.store_id
      ? supabase.from("stores").select("*").eq("id", employee.store_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("rota_shifts")
      .select("*")
      .eq("employee_id", employee.id)
      .gte("shift_date", toISODate(weekStart))
      .lte("shift_date", toISODate(weekEnd))
      .order("shift_date"),
    supabase
      .from("clock_events")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("event_date", today)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        title={`Hi ${employee.name.split(" ")[0]}`}
        description="Clock in & out, see your week. Location is required to log shifts."
      />
      <CrewClockApp
        employee={employee as Employee}
        store={(storeRes.data ?? null) as Store | null}
        weekShifts={(shiftsRes.data ?? []) as RotaShift[]}
        todayClock={(clockRes.data ?? null) as ClockEvent | null}
      />
    </>
  );
}
