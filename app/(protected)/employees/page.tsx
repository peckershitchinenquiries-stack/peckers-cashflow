import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase } from "@/lib/supabase-server";
import { EmployeesView } from "@/components/employees/EmployeesView";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const supabase = createServerSupabase();
  const [empRes, hoursRes] = await Promise.all([
    supabase.from("employees").select("*").order("is_active", { ascending: false }).order("name"),
    supabase
      .from("employee_hours_computed")
      .select("*")
      .order("week_start_date", { ascending: false })
      .limit(500),
  ]);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage staff, log weekly hours and review cash payments."
      />
      <EmployeesView
        initialEmployees={empRes.data ?? []}
        initialHours={(hoursRes.data ?? []) as any[]}
      />
    </>
  );
}
