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
    /**
     * Where `labour` went, as money. Null when the week has no labour lines to
     * split, or when the parts disagree with `labour` (a drifted snapshot).
     */
    labourSplit: {
      /** A manager's fixed daily wage plus any cash hours. Their drops are not here. */
      managers: number;
      /** Hourly pay of everyone whose position is not a driver's. */
      kitchen: number;
      /**
       * Drivers' hourly pay, every drop allowance, cover drivers' hourly pay,
       * and a dual-role person's estimated delivery share. Classified by
       * `employees.position` — see `lib/dashboard/labour-roles.ts`.
       */
      delivery: number;
      /** Ad-hoc cover, belonging to none of the above. 0 when there is none. */
      outsourced: number;
      /** Who the ad-hoc lines actually name, so the row isn't an anonymous "Other". */
      outsourcedLabel: string | null;
    } | null;
    storeContribution: number;
    storeContributionPct: number;
    netMargin: number;
    /** Fraction of GROSS sales. */
    netMarginPct: number;
  } | null;
  reportHref: string;
  labourHref: string;
};

/** One pickable week on the performance card's week selector. */
export type PerformanceWeekOption = {
  iso: string;
  /** "28/09 – 04/10", built server-side so the client does no date maths. */
  label: string;
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
  /** The week the user is LOOKING at, which may not be the one that just ended. */
  performance: LastWeekPerformance;
  thisTuesday: PayoutCardData;
  nextTuesday: PayoutCardData;
  needsAction: NeedsActionData;
};
