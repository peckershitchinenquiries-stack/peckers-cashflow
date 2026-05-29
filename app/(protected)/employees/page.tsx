import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { EmployeesView } from "@/components/employees/EmployeesView";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requireUser();
  const supabase = createServerSupabase();
  const [empRes, hoursRes, storesRes] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .order("employment_status")
      .order("name"),
    supabase
      .from("employee_hours_computed")
      .select("*")
      .order("week_start_date", { ascending: false })
      .limit(500),
    supabase.from("stores").select("*").order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Full profile, pay rates, bank details, store assignment. Required for payroll & rota."
      />
      <EmployeesView
        initialEmployees={empRes.data ?? []}
        initialHours={(hoursRes.data ?? []) as any[]}
        stores={storesRes.data ?? []}
        defaultStoreId={user.allowed?.store_id ?? null}
      />
    </>
  );
}
