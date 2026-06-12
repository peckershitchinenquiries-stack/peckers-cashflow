import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();
  const [{ data: stores }, { data: employees }] = await Promise.all([
    supabase.from("stores").select("id, name").order("name"),
    supabase.from("employees").select("id, store_id"),
  ]);

  const employeesByStore: Record<string, string[]> = {};
  for (const e of employees ?? []) {
    if (e.store_id) (employeesByStore[e.store_id] ??= []).push(e.id);
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cash flow trends per store — across weeks and months."
      />
      <AnalyticsView
        stores={stores ?? []}
        employeesByStore={employeesByStore}
        isAdmin
        defaultStoreId={stores?.[0]?.id ?? ""}
      />
    </>
  );
}
