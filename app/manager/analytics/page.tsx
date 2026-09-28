import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveActiveStoreId } from "@/lib/types";
import { AnalyticsView, type AnalyticsEmployee } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function ManagerAnalyticsPage() {
  const user = await requireRole(["manager"]);
  const storeId = resolveActiveStoreId(user.allowed);

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
    // Estate-wide, not this store's roster: someone whose home store is the
    // other one still has to be priced when they cover a shift here, and their
    // NI allowance is a rule over their whole week wherever it was worked.
    supabase
      .from("employees")
      .select("id, name, store_id, hourly_cash_rate, bank_weekly_hours_limit"),
  ]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cash flow trends for your store — across weeks and months."
      />
      <AnalyticsView
        stores={store ? [store] : []}
        employees={(employees ?? []) as AnalyticsEmployee[]}
        isAdmin={false}
        defaultStoreId={storeId}
      />
    </>
  );
}
