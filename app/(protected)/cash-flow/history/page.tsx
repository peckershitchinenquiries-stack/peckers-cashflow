import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { PayoutHistoryView } from "@/components/cash-flow/PayoutHistoryView";
import type { CashPayoutWithLines, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CashFlowHistoryPage() {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();

  const [storesRes, payoutsRes] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase
      .from("cash_payouts")
      .select("*, stores(name), cash_payout_lines(*)")
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
      <PayoutHistoryView payouts={payouts} stores={(storesRes.data ?? []) as Store[]} isAdmin />
    </>
  );
}
