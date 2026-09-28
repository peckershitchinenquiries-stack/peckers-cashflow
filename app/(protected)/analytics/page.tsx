import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { AnalyticsView, type AnalyticsEmployee } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();
  const [{ data: stores }, { data: employees }] = await Promise.all([
    supabase.from("stores").select("id, name").order("name"),
    // The whole estate, with rates: cash is owed by the store each shift was
    // worked at, and the NI allowance is a rule over the employee's FULL week.
    supabase
      .from("employees")
      .select("id, name, store_id, hourly_cash_rate, bank_weekly_hours_limit"),
  ]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cash flow trends per store — across weeks and months."
      />
      <AnalyticsView
        stores={stores ?? []}
        employees={(employees ?? []) as AnalyticsEmployee[]}
        isAdmin
        defaultStoreId={stores?.[0]?.id ?? ""}
      />
    </>
  );
}
