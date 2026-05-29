import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { AlertsView } from "@/components/alerts/AlertsView";
import type { Employee, Store, SystemAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerAlertsPage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? "";
  const supabase = createServerSupabase();

  const [alertsRes, storesRes, employeesRes] = await Promise.all([
    supabase
      .from("alerts")
      .select("*")
      .eq("store_id", storeId)
      .order("resolved")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("stores").select("*").eq("id", storeId),
    supabase
      .from("employees")
      .select("id, name, position, store_id")
      .eq("store_id", storeId)
      .limit(500),
  ]);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Warnings for your store: hours variance, deliveries, late or missing clock-ins."
      />
      <AlertsView
        initialAlerts={(alertsRes.data ?? []) as SystemAlert[]}
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
      />
    </>
  );
}
