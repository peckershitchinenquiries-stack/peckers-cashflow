import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveWeek } from "@/lib/cash-flow";
import { buildDashboardViews } from "@/lib/cash-flow-data";
import { CashFlowDashboard } from "@/components/cash-flow/CashFlowDashboard";

export const dynamic = "force-dynamic";

export default async function CashFlowDashboardPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();
  const { weekStart } = resolveWeek(searchParams.week);
  const { data: stores } = await supabase.from("stores").select("id, name").order("name");
  const views = await buildDashboardViews(stores ?? [], weekStart);

  return (
    <>
      <PageHeader
        title="Cash Flow"
        description="Daily reconciliation, running balance, and Saturday wage forecast per store."
      />
      <CashFlowDashboard views={views} weekStart={weekStart} basePath="/cash-flow" />
    </>
  );
}
