import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { EmployeesView } from "@/components/employees/EmployeesView";

export const dynamic = "force-dynamic";

export default async function ManagerEmployeesPage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? "";
  const supabase = createServerSupabase();

  const [empRes, hoursRes, storesRes] = await Promise.all([
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
  ]);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Your store's staff. New employees get an auto-generated crew login."
      />
      <EmployeesView
        initialEmployees={empRes.data ?? []}
        initialHours={(hoursRes.data ?? []) as any[]}
        stores={storesRes.data ?? []}
        defaultStoreId={storeId || null}
        lockToStore
      />
    </>
  );
}
