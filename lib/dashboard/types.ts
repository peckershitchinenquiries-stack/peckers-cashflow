import type { WeeklyReportStatus } from "@/lib/weekly-report";

export type DashboardStore = {
  id: string;
  code: string | null;
  name: string;
  vm_store_name: string | null;
};

export type DashboardWeeks = {
  today: string;
  yesterday: string;
  thisWeek: string;
  lastWeek: string;
  weekBefore: string;
  nextWeek: string;
};

export type LastWeekPerformance = {
  weekStart: string;
  weekEnd: string;
  status: WeeklyReportStatus | null;
  loadError: string | null;
  grossSales: number;
  netSales: number;
  /** Whole percentages, null when there is nothing honest to compare against. */
  wowPct: number | null;
  yoyNetPct: number | null;
  hasYoyRow: boolean;
  /** Null when the store has no weekly report row for the week. */
  pnl: {
    labour: number;
    /** Fractions of NET sales, as generateWeeklySummary returns them. */
    labourPct: number;
    labourBudgetPct: number;
    /** budget − actual, so NEGATIVE means over budget. */
    labourVariancePct: number;
    storeContribution: number;
    storeContributionPct: number;
    netMargin: number;
    /** Fraction of GROSS sales. */
    netMarginPct: number;
  } | null;
  reportHref: string;
  labourHref: string;
};

export type PayoutState = "not_generated" | "draft" | "confirmed";

export type PayoutFigures = {
  cashAvailable: number;
  openingBalance: number;
  cashCollected: number;
  supermarketFloat: number;
  wages: number;
  cashWages: number;
  deliveryWages: number;
  adjustment: number;
  postOfficeDraw: number;
  surplus: number;
};

export type PayoutCardData = {
  weekStart: string;
  payday: string;
  payWeek: { start: string; end: string };
  state: PayoutState;
  confirmedByName: string | null;
  /** Null exactly when loadError is set — a broken query must never show £0. */
  figures: PayoutFigures | null;
  loadError: string | null;
  href: string;
};

export type NeedsActionData = {
  /** Every failed query, by what it was for. Non-empty means "All clear" is never shown. */
  errors: string[];
  approvalSince: string;
  /** Null when the query behind it failed. */
  unapprovedDays: number | null;
  missingCashDates: string[] | null;
  changedEnvelopeDates: string[] | null;
  /** Unapproved days in a pay week whose payout is already confirmed. */
  unpaidOnConfirmedSheet: number;
  reportNotLocked: boolean;
  labourOverPts: number | null;
  openAlerts: number | null;
  reportHref: string;
  labourHref: string;
};

export type StoreDashboard = {
  store: DashboardStore;
  performance: LastWeekPerformance;
  thisTuesday: PayoutCardData;
  nextTuesday: PayoutCardData;
  needsAction: NeedsActionData;
};
