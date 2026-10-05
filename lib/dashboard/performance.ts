import { addDays, parseISODate, toISODate } from "@/lib/utils";
import { getYoy } from "@/lib/vm-analytics/queries";
import { share } from "@/lib/vm-analytics/channels";
import { shortStore } from "@/lib/vm-analytics/constants";
import { generateWeeklySummary } from "@/lib/vm-analytics/weekly-summary";
import { loadVmSales } from "@/lib/weekly-report-sales";
import { loadStoreWeekFigures } from "@/lib/weekly-report-figures";
import { num, round2, type WeeklyReportLabourLine } from "@/lib/weekly-report";
import { getCashflowSupabaseServer } from "@/lib/supabase-cashflow";
import { labourRoleSplitFromLines, type PositionsById } from "./labour-roles";
import type { DashboardStore, LastWeekPerformance } from "./types";

/**
 * One COMPLETED week's headline P&L for a store.
 *
 * The week is a parameter, not always the one that just ended: a report is
 * filled on the Tuesday after the week it covers, so on a Monday the card's
 * default week has nothing in it yet and the dashboard's week picker is the
 * only way to see a week that does (Update 234).
 */
export async function loadWeekPerformance(
  store: DashboardStore,
  weekIso: string,
): Promise<LastWeekPerformance> {
  const vmName = store.vm_store_name;
  const weekBefore = toISODate(addDays(parseISODate(weekIso), -7));
  const [figures, before, yoyRow] = await Promise.all([
    loadStoreWeekFigures(store.id, vmName, weekIso),
    loadVmSales(vmName, weekBefore),
    vmName ? getYoy(weekIso, vmName).catch(() => null) : Promise.resolve(null),
  ]);

  const { gross_sales, net_sales } = figures.sales;
  const yoyNet = yoyRow ? num(yoyRow.total_sales) : 0;
  const storeParam = vmName ? shortStore(vmName).toLowerCase() : "";
  const reportHref = `/vm-analytics/weekly-summary?week=${weekIso}&store=${storeParam}`;

  let pnl: LastWeekPerformance["pnl"] = null;
  if (figures.inputs) {
    const positions = await loadPositions(figures.bundle.labour);
    const summary = generateWeeklySummary(figures.sales, figures.inputs);
    const labour = summary.metrics.find((m) => m.entity === "Labour");
    const labourTotal = labour?.actual ?? 0;
    pnl = {
      labour: labourTotal,
      labourPct: labour?.actual_pct ?? 0,
      labourBudgetPct: labour?.budget_pct ?? 0,
      labourVariancePct: labour?.variance_pct ?? 0,
      labourSplit: labourSplitOf(figures.bundle.labour, labourTotal, positions),
      storeContribution: summary.totals.store_contribution ?? 0,
      storeContributionPct: summary.totals.store_contribution_pct ?? 0,
      netMargin: summary.totals.net_margin ?? 0,
      netMarginPct: summary.totals.net_margin_pct ?? 0,
    };
  }

  return {
    weekStart: weekIso,
    weekEnd: toISODate(addDays(parseISODate(weekIso), 6)),
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

/**
 * `employees.position` for the people on the week's labour lines.
 *
 * A Driver's hours are delivery cost whatever their drop count says, so the
 * split asks the roster rather than inferring a role from productivity. A
 * failed query returns an empty map, which falls every line back to the
 * drops estimate — a worse split, but never a wrong total.
 */
async function loadPositions(
  lines: WeeklyReportLabourLine[] | null | undefined,
): Promise<PositionsById> {
  const ids = [
    ...new Set(
      (lines ?? []).filter((l) => l.source === "employee" && l.employee_id).map((l) => l.employee_id!),
    ),
  ];
  if (ids.length === 0) return new Map();
  const { data } = await getCashflowSupabaseServer()
    .from("employees")
    .select("id,position")
    .in("id", ids);
  return new Map((data ?? []).map((e) => [e.id as string, (e.position as string | null) ?? null]));
}

/**
 * `pnl.labour` split by ROLE — managers, kitchen, delivery, outsourced — from
 * the SAME lines the headline is priced from, so the parts cannot tell a
 * different story than the figure above them.
 *
 * Classified by each person's position; only a dual-role person falls to the
 * drops estimate. `labour-roles.ts` explains how and why.
 *
 * Returns null when the parts don't reconcile with the headline — a frozen
 * snapshot whose lines have since drifted (Update 128). The dashboard tile is a
 * summary, not the place to adjudicate the discrepancy: it HIDES the breakdown
 * and leaves the weekly report, which already carries the drift warning and is
 * one click away, to explain it. A breakdown contradicting the number it sits
 * under is worse than no breakdown.
 */
function labourSplitOf(
  lines: WeeklyReportLabourLine[] | null | undefined,
  headline: number,
  positions: PositionsById,
): NonNullable<LastWeekPerformance["pnl"]>["labourSplit"] {
  if (!lines || lines.length === 0) return null;
  const r = labourRoleSplitFromLines(lines, positions);
  const split = {
    managers: r.managers,
    kitchen: r.kitchen,
    delivery: r.delivery,
    outsourced: r.outsourced,
    outsourcedLabel: adhocLabel(lines),
  };
  const parts = round2(split.managers + split.kitchen + split.delivery + split.outsourced);
  return Math.abs(parts - round2(headline)) > 0.005 ? null : split;
}

/**
 * The ad-hoc row named after the people on it ("Apoorva + Rajesh + Gopal"),
 * read from the week's own lines rather than hardcoded: who is outsourced
 * changes week to week, and a fixed list of names would quietly start lying.
 */
function adhocLabel(lines: WeeklyReportLabourLine[]): string | null {
  const names = [
    ...new Set(
      lines
        .filter((l) => l.source === "adhoc")
        .map((l) => (l.person_name ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (names.length === 0) return null;
  if (names.length > 3) return `${names.slice(0, 3).join(" + ")} + ${names.length - 3} more`;
  return names.join(" + ");
}
