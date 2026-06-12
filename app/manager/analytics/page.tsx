import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function ManagerAnalyticsPage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? null;

  if (!storeId) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Card>
          <p className="text-sm text-text-muted">No store assigned to your account.</p>
        </Card>
      </>
    );
  }

  const supabase = createServerSupabase();
  const [{ data: store }, { data: employees }] = await Promise.all([
    supabase.from("stores").select("id, name").eq("id", storeId).maybeSingle(),
    supabase.from("employees").select("id").eq("store_id", storeId),
  ]);

  const employeesByStore: Record<string, string[]> = {
    [storeId]: (employees ?? []).map((e) => e.id),
  };

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cash flow trends for your store — across weeks and months."
      />
      <AnalyticsView
        stores={store ? [store] : []}
        employeesByStore={employeesByStore}
        isAdmin={false}
        defaultStoreId={storeId}
      />
    </>
  );
}
