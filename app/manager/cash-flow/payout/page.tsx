import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveActiveStoreId } from "@/lib/types";
import { resolveWeek } from "@/lib/cash-flow";
import { getPrePaymentSummary, getPayoutForWeek } from "@/app/actions/payouts";
import { PrePaymentView } from "@/components/cash-flow/PrePaymentView";

export const dynamic = "force-dynamic";

export default async function ManagerCashFlowPayoutPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const user = await requireRole(["manager"]);
  const storeId = resolveActiveStoreId(user.allowed);

  if (!storeId) {
    return (
      <>
        <PageHeader title="Tuesday Payout" />
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
  if (!store) {
    return (
      <>
        <PageHeader title="Tuesday Payout" />
        <Card>
          <p className="text-sm text-text-muted">Store not found.</p>
        </Card>
      </>
    );
  }

  const [summary, payout] = await Promise.all([
    getPrePaymentSummary({ store_id: store.id, week_start: weekStart }),
    getPayoutForWeek({ store_id: store.id, week_start: weekStart }),
  ]);

  return (
    <>
      <PageHeader
        title="Tuesday Cash &amp; Delivery Wages"
        description="Pre-payment summary, Post Office draw, and per-employee wage confirmation."
      />
      <PrePaymentView
        summary={summary}
        payout={payout}
        store={store}
        stores={[store]}
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        isAdmin={false}
        basePath="/manager/cash-flow"
      />
    </>
  );
}
