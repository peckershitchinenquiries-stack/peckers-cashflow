import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveWeek } from "@/lib/cash-flow";
import { loadOpeningBalances, loadWeekEntries } from "@/lib/cash-flow-data";
import { DailyCashView } from "@/components/cash-flow/DailyCashView";

export const dynamic = "force-dynamic";

export default async function ManagerCashFlowDailyPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? null;

  if (!storeId) {
    return (
      <>
        <PageHeader title="Daily Cash Entry" />
        <Card>
          <p className="text-sm text-text-muted">No store assigned to your account.</p>
        </Card>
      </>
    );
  }

  const supabase = createServerSupabase();
  const { weekStart, prevWeek, nextWeek } = resolveWeek(searchParams.week);
  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  const storeList = store ? [store] : [];
  const [entries, openingByStore] = await Promise.all([
    loadWeekEntries([storeId], weekStart),
    loadOpeningBalances([storeId], weekStart),
  ]);

  return (
    <>
      <PageHeader
        title="Daily Cash Entry"
        description="Record Vita Mojo cash sales against the envelope and track the running balance."
      />
      <DailyCashView
        stores={storeList}
        entries={entries}
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        openingByStore={openingByStore}
        isAdmin={false}
        basePath="/manager/cash-flow"
        defaultStoreId={storeId}
      />
    </>
  );
}
