import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase } from "@/lib/supabase-server";
import { isProvisioningConfigured } from "@/lib/supabase-admin";
import { ManagersView } from "@/components/managers/ManagersView";
import type { AllowedUser, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const supabase = createServerSupabase();
  const [managersRes, storesRes] = await Promise.all([
    supabase
      .from("allowed_users")
      .select("*")
      .eq("role", "manager")
      .order("created_at", { ascending: false }),
    supabase.from("stores").select("*").order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Managers"
        description="Create store-manager logins. The system generates a username & password to share."
      />
      <ManagersView
        managers={(managersRes.data ?? []) as AllowedUser[]}
        stores={(storesRes.data ?? []) as Store[]}
        provisioningReady={isProvisioningConfigured()}
      />
    </>
  );
}
