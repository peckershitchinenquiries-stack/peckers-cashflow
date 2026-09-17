// =============================================================
// One store-week's P&L inputs, resolved the way the Weekly Report shows them.
//
// Shared by the Weekly Summary's combined view and the admin dashboard so the
// two can never disagree about which sales and costs a week is measured on.
// A plain module, not "use server": every export there is a callable endpoint.
// =============================================================

import { loadWeeklyReport, type WeeklyReportBundle } from "@/app/actions/weekly-report";
import { loadVmSales, type VmSales } from "./weekly-report-sales";
import { rollUpInputs, type WeeklyReportStatus } from "./weekly-report";
import type { WeeklySummaryInputs } from "./vm-analytics/weekly-summary";

export type StoreWeekFigures = {
  bundle: WeeklyReportBundle;
  status: WeeklyReportStatus | null;
  /** True when sales and inputs come from the lock-time snapshot. */
  frozen: boolean;
  sales: VmSales;
  /** Null when the store has no report row for the week. */
  inputs: WeeklySummaryInputs | null;
};

export async function loadStoreWeekFigures(
  storeId: string,
  vmStoreName: string | null,
  weekIso: string,
): Promise<StoreWeekFigures> {
  const [bundle, liveSales] = await Promise.all([
    loadWeeklyReport({ store_id: storeId, week_start: weekIso }),
    loadVmSales(vmStoreName, weekIso),
  ]);
  const { report } = bundle;
  // A locked report is measured on what was FROZEN, or a rate changed later
  // would restate a report already sent.
  const snapshot = report && report.status !== "draft" ? report.snapshot : null;
  return {
    bundle,
    status: report?.status ?? null,
    frozen: Boolean(snapshot),
    sales: snapshot
      ? { gross_sales: snapshot.gross_sales, net_sales: snapshot.net_sales }
      : liveSales,
    inputs: report
      ? snapshot?.inputs ?? rollUpInputs(report, bundle.lines, bundle.labour)
      : null,
  };
}
