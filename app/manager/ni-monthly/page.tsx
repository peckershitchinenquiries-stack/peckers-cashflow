import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveActiveStoreId } from "@/lib/types";
import { loadManualNiRows, loadNiRows } from "@/lib/ni-data";
import { NiMonthlyView } from "@/components/ni/NiMonthlyView";

export const dynamic = "force-dynamic";

export default async function ManagerNiMonthlyPage() {
  const user = await requireRole(["manager"]);
  const storeId = resolveActiveStoreId(user.allowed);

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
        description="Approved hours worked in each calendar month for your store. NI is capped at the monthly policy figure (20 hrs/week × 52 ÷ 12 = 86 hr 40 min) and the rest is cash. Reporting only — the Tuesday payout still pays the weekly 20-hour rule."
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
