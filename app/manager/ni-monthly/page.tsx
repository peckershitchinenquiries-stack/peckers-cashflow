import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { loadManualNiRows, loadNiRows } from "@/lib/ni-data";
import { NiMonthlyView } from "@/components/ni/NiMonthlyView";

export const dynamic = "force-dynamic";

export default async function ManagerNiMonthlyPage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? null;

  if (!storeId) {
    return (
      <>
        <PageHeader title="NI — Monthly Summary" />
        <Card>
          <p className="text-sm text-text-muted">No store assigned to your account.</p>
        </Card>
      </>
    );
  }

  const supabase = createServerSupabase();
  const [{ data: store }, rows, manualRows] = await Promise.all([
    supabase.from("stores").select("id, name").eq("id", storeId).maybeSingle(),
    loadNiRows(storeId),
    loadManualNiRows(storeId),
  ]);

  return (
    <>
      <PageHeader
        title="NI — Monthly Summary"
        description="National Insurance (PAYE) wages for your store, grouped by calendar month. NI is paid monthly; cash is paid weekly."
      />
      <NiMonthlyView
        rows={rows}
        manualRows={manualRows}
        stores={store ? [store] : []}
        isAdmin={false}
      />
    </>
  );
}
