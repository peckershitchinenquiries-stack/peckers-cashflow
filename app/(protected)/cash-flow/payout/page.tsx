import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveWeek } from "@/lib/cash-flow";
import { getPrePaymentSummary, getPayoutForWeek } from "@/app/actions/payouts";
import { PrePaymentView } from "@/components/cash-flow/PrePaymentView";

export const dynamic = "force-dynamic";

export default async function CashFlowPayoutPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();
  const { weekStart, prevWeek, nextWeek } = resolveWeek(searchParams.week);
  const { data: stores } = await supabase.from("stores").select("id, name").order("name");
  const storeList = stores ?? [];
  const store = storeList.find((s) => s.id === searchParams.store) ?? storeList[0];

  if (!store) {
    return (
      <>
        <PageHeader title="Saturday Payout" />
        <p className="text-sm text-text-muted">No stores configured.</p>
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
        title="Saturday Cash &amp; Delivery Wages"
        description="Pre-payment summary, Post Office draw, and per-employee wage confirmation."
      />
      <PrePaymentView
        summary={summary}
        payout={payout}
        store={store}
        stores={storeList}
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        isAdmin
        basePath="/cash-flow"
      />
    </>
  );
}
