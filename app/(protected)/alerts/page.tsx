import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase } from "@/lib/supabase-server";
import { AlertsView } from "@/components/alerts/AlertsView";
import type { Employee, Store, SystemAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = createServerSupabase();

  const [alertsRes, storesRes, employeesRes] = await Promise.all([
    supabase
      .from("alerts")
      .select("*")
      .order("resolved")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("stores").select("*").order("name"),
    supabase.from("employees").select("id, name, position, store_id").limit(500),
  ]);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="System-generated warnings for hours variance, deliveries, and late or missing clock-ins."
      />
      <AlertsView
        initialAlerts={(alertsRes.data ?? []) as SystemAlert[]}
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
      />
    </>
  );
}
