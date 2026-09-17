import type { SupabaseClient } from "@supabase/supabase-js";
import { getPrePaymentSummary } from "@/app/actions/payouts";
import { payWeekOf } from "@/lib/cash-flow";
import { addDays, parseISODate, toISODate } from "@/lib/utils";
import type { CashPayout, PrePaymentSummary } from "@/lib/types";
import type { DashboardStore, DashboardWeeks, PayoutCardData, PayoutFigures } from "./types";

type PayoutHeader = Pick<
  CashPayout,
  | "id"
  | "store_id"
  | "week_start_date"
  | "status"
  | "locked"
  | "opening_balance"
  | "cash_collected"
  | "actual_cash_available"
  | "total_cash_wages"
  | "total_delivery_wages"
  | "grand_total_wages"
  | "adjustment_amount"
  | "post_office_draw"
  | "surplus_carry_forward"
  | "confirmed_at"
  | "confirmed_by_name"
>;

export type PayoutHeaders = { rows: PayoutHeader[]; error: string | null };

export async function loadPayoutHeaders(
  supabase: SupabaseClient,
  weeks: DashboardWeeks,
): Promise<PayoutHeaders> {
  const { data, error } = await supabase
    .from("cash_payouts")
    .select(
      "id, store_id, week_start_date, status, locked, opening_balance, cash_collected, actual_cash_available, total_cash_wages, total_delivery_wages, grand_total_wages, adjustment_amount, post_office_draw, surplus_carry_forward, confirmed_at, confirmed_by_name",
    )
    .in("week_start_date", [weeks.thisWeek, weeks.nextWeek]);
  return { rows: (data ?? []) as PayoutHeader[], error: error?.message ?? null };
}

export async function loadPayoutSummary(
  storeId: string,
  weekStart: string,
): Promise<PrePaymentSummary | { load_error: string }> {
  try {
    return await getPrePaymentSummary({ store_id: storeId, week_start: weekStart });
  } catch (e) {
    return { load_error: e instanceof Error ? e.message : "Payout summary failed" };
  }
}

// Mirrors PrePaymentView: a confirmed payout is a frozen snapshot, so its
// header is shown rather than whatever the live summary computes today.
function frozenFigures(h: PayoutHeader): PayoutFigures {
  const n = (v: unknown) => Number(v) || 0;
  return {
    cashAvailable: n(h.actual_cash_available),
    openingBalance: n(h.opening_balance),
    cashCollected: n(h.cash_collected),
    supermarketFloat: Math.max(
      0,
      n(h.actual_cash_available) - n(h.cash_collected) - n(h.opening_balance),
    ),
    wages: n(h.grand_total_wages),
    cashWages: n(h.total_cash_wages),
    deliveryWages: n(h.total_delivery_wages),
    adjustment: n(h.adjustment_amount),
    postOfficeDraw: n(h.post_office_draw),
    surplus: n(h.surplus_carry_forward),
  };
}

function liveFigures(s: PrePaymentSummary): PayoutFigures {
  return {
    cashAvailable: s.actual_cash_available,
    openingBalance: s.opening_balance,
    cashCollected: s.cash_collected,
    supermarketFloat: s.supermarket_cash,
    wages: s.grand_total_wages,
    cashWages: s.total_cash_wages,
    deliveryWages: s.total_delivery_wages,
    adjustment: s.adjustment,
    postOfficeDraw: s.post_office_draw,
    surplus: s.surplus,
  };
}

export function buildPayoutCard(
  store: DashboardStore,
  weekStart: string,
  summary: PrePaymentSummary | { load_error: string },
  headers: PayoutHeaders,
): PayoutCardData {
  const header = headers.rows.find(
    (h) => h.store_id === store.id && h.week_start_date === weekStart,
  );
  const state = header ? (header.status === "confirmed" ? "confirmed" : "draft") : "not_generated";
  const base = {
    weekStart,
    payday: toISODate(addDays(parseISODate(weekStart), 1)),
    payWeek: payWeekOf(weekStart),
    confirmedByName: header?.confirmed_by_name ?? null,
    href: `/cash-flow/payout?week=${weekStart}&store=${store.id}`,
  };

  // Without the header we cannot know whether the frozen figures apply.
  if (headers.error) {
    return { ...base, state, figures: null, loadError: headers.error };
  }
  if (header && state === "confirmed") {
    return { ...base, state, figures: frozenFigures(header), loadError: null };
  }
  if (summary.load_error || !("actual_cash_available" in summary)) {
    return { ...base, state, figures: null, loadError: summary.load_error ?? "Payout summary failed" };
  }
  return { ...base, state, figures: liveFigures(summary), loadError: null };
}
