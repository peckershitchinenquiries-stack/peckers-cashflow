import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { resolveActiveStoreId } from "@/lib/types";
import { PayoutHistoryView } from "@/components/cash-flow/PayoutHistoryView";
import type { CashPayoutWithLines, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerCashFlowHistoryPage() {
  const user = await requireRole(["manager"]);
  const storeId = resolveActiveStoreId(user.allowed);

  if (!storeId) {
    return (
      <>
        <PageHeader title="Weekly Payout Summaries" />
        <Card>
          <p className="text-sm text-text-muted">No store assigned to your account.</p>
        </Card>
      </>
    );
  }

  const supabase = createServerSupabase();
  const [storesRes, payoutsRes] = await Promise.all([
    supabase.from("stores").select("*").eq("id", storeId),
    supabase
      .from("cash_payouts")
      .select("*, stores(name), cash_payout_lines(*)")
      .eq("store_id", storeId)
      .order("week_start_date", { ascending: false })
      .limit(500),
  ]);

  const payouts: CashPayoutWithLines[] = (payoutsRes.data ?? []).map((row) => {
    const { stores, cash_payout_lines, ...header } = row as Record<string, unknown> & {
      stores: { name: string } | null;
      cash_payout_lines: unknown[];
    };
    return {
      ...(header as unknown as CashPayoutWithLines),
      store_name: stores?.name ?? null,
      lines: ((cash_payout_lines ?? []) as CashPayoutWithLines["lines"]).sort(
        (a, b) => b.total_payment - a.total_payment,
      ),
    };
  });

  return (
    <>
      <PageHeader
        title="Weekly Payout Summaries"
        description="Permanent record of cash wages paid each week. Searchable and exportable."
      />
      <PayoutHistoryView payouts={payouts} stores={(storesRes.data ?? []) as Store[]} isAdmin={false} />
    </>
  );
}
