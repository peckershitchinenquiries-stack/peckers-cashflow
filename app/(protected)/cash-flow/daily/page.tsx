import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveWeek } from "@/lib/cash-flow";
import { loadOpeningBalances, loadWeekEntries } from "@/lib/cash-flow-data";
import { DailyCashView } from "@/components/cash-flow/DailyCashView";

export const dynamic = "force-dynamic";

export default async function CashFlowDailyPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();
  const { weekStart, prevWeek, nextWeek } = resolveWeek(searchParams.week);
  const { data: stores } = await supabase.from("stores").select("id, name").order("name");
  const storeList = stores ?? [];
  const storeIds = storeList.map((s) => s.id);
  const [entries, openingByStore] = await Promise.all([
    loadWeekEntries(storeIds, weekStart),
    loadOpeningBalances(storeIds, weekStart),
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
        isAdmin
        basePath="/cash-flow"
        defaultStoreId={storeList[0]?.id ?? ""}
      />
    </>
  );
}
