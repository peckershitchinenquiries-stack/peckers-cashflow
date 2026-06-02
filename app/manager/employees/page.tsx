import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { EmployeesView } from "@/components/employees/EmployeesView";
import { addDays, groupClockEventsByWeek, startOfISOWeek, toISODate } from "@/lib/utils";
import type { Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerEmployeesPage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? "";
  const supabase = createServerSupabase();

  const eightWeeksBack = toISODate(addDays(startOfISOWeek(new Date()), -56));

  const [empRes, hoursRes, storesRes, clocksRes] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .eq("store_id", storeId)
      .order("employment_status")
      .order("name"),
    supabase
      .from("employee_hours_computed")
      .select("*")
      .order("week_start_date", { ascending: false })
      .limit(500),
    supabase.from("stores").select("*").eq("id", storeId),
    supabase
      .from("clock_events")
      .select("employee_id, event_date, clock_in_at, clock_out_at")
      .eq("store_id", storeId)
      .gte("event_date", eightWeeksBack)
      .not("clock_out_at", "is", null)
      .order("event_date", { ascending: false }),
  ]);

  const employees = (empRes.data ?? []) as Employee[];
  const empMap = new Map(
    employees.map((e) => ({
      id: e.id,
      name: e.name,
      hourly_ni_rate: e.hourly_ni_rate,
      hourly_rate: e.hourly_rate,
    })).map((e) => [e.id, e]),
  );
  const clockSummaries = groupClockEventsByWeek(clocksRes.data ?? [], empMap);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Your store's staff. New employees get an auto-generated crew login."
      />
      <EmployeesView
        initialEmployees={employees}
        initialHours={(hoursRes.data ?? []) as any[]}
        clockSummaries={clockSummaries}
        stores={storesRes.data ?? []}
        defaultStoreId={storeId || null}
        lockToStore
      />
    </>
  );
}
