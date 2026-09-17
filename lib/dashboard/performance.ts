import { addDays, parseISODate, toISODate } from "@/lib/utils";
import { getYoy } from "@/lib/vm-analytics/queries";
import { share } from "@/lib/vm-analytics/channels";
import { shortStore } from "@/lib/vm-analytics/constants";
import { generateWeeklySummary } from "@/lib/vm-analytics/weekly-summary";
import { loadVmSales } from "@/lib/weekly-report-sales";
import { loadStoreWeekFigures } from "@/lib/weekly-report-figures";
import { num } from "@/lib/weekly-report";
import type { DashboardStore, DashboardWeeks, LastWeekPerformance } from "./types";

export async function loadLastWeekPerformance(
  store: DashboardStore,
  weeks: DashboardWeeks,
): Promise<LastWeekPerformance> {
  const vmName = store.vm_store_name;
  const [figures, before, yoyRow] = await Promise.all([
    loadStoreWeekFigures(store.id, vmName, weeks.lastWeek),
    loadVmSales(vmName, weeks.weekBefore),
    vmName ? getYoy(weeks.lastWeek, vmName).catch(() => null) : Promise.resolve(null),
  ]);

  const { gross_sales, net_sales } = figures.sales;
  const yoyNet = yoyRow ? num(yoyRow.total_sales) : 0;
  const storeParam = vmName ? shortStore(vmName).toLowerCase() : "";
  const reportHref = `/vm-analytics/weekly-summary?week=${weeks.lastWeek}&store=${storeParam}`;

  let pnl: LastWeekPerformance["pnl"] = null;
  if (figures.inputs) {
    const summary = generateWeeklySummary(figures.sales, figures.inputs);
    const labour = summary.metrics.find((m) => m.entity === "Labour");
    pnl = {
      labour: labour?.actual ?? 0,
      labourPct: labour?.actual_pct ?? 0,
      labourBudgetPct: labour?.budget_pct ?? 0,
      labourVariancePct: labour?.variance_pct ?? 0,
      storeContribution: summary.totals.store_contribution ?? 0,
      storeContributionPct: summary.totals.store_contribution_pct ?? 0,
      netMargin: summary.totals.net_margin ?? 0,
      netMarginPct: summary.totals.net_margin_pct ?? 0,
    };
  }

  return {
    weekStart: weeks.lastWeek,
    weekEnd: toISODate(addDays(parseISODate(weeks.lastWeek), 6)),
    status: figures.status,
    loadError: figures.bundle.load_error,
    grossSales: gross_sales,
    netSales: net_sales,
    // A week VM hasn't synced reads as 0, which is "unknown", not −100%.
    wowPct:
      before.gross_sales > 0 && gross_sales > 0
        ? share(gross_sales - before.gross_sales, before.gross_sales)
        : null,
    // vm_yoy_* holds NET sales only, so the comparison is net to net.
    yoyNetPct: yoyNet > 0 && net_sales > 0 ? share(net_sales - yoyNet, yoyNet) : null,
    hasYoyRow: yoyRow !== null,
    pnl,
    reportHref,
    labourHref: `${reportHref}&tab=labour`,
  };
}
