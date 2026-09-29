import { Suspense } from "react";
import { DashboardSelector } from "@/components/vm-analytics/nav/DashboardSelector";
import { WeekSelector } from "@/components/vm-analytics/nav/WeekSelector";
import { StoreSelector } from "@/components/vm-analytics/nav/StoreSelector";
import { getWeeks } from "@/lib/vm-analytics/queries";
import { getLabourWeeks } from "@/lib/vm-analytics/labour";
import { reportWeekOptions } from "@/lib/weekly-report";

export default function VmAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* VM Analytics sub-nav: dashboard picker + store/week selectors */}
      <div className="flex flex-col gap-3 pb-4 border-b border-border md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="w-full md:w-64">
          <Suspense fallback={<div className="text-sm text-text-muted">Loading…</div>}>
            <DashboardSelector />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <WeekNav />
        </Suspense>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * The selectors' own data, fetched BELOW a Suspense boundary.
 *
 * A layout has to return before its children render, so awaiting the week lists
 * in the layout body put those two round trips in front of every dashboard
 * beneath it — the dashboard could not even start querying until the picker
 * knew which weeks exist. Down here the two render side by side, and the page
 * is no longer waiting on a control that does not affect it.
 */
async function WeekNav() {
  // The Labour Cost dashboard offers the weeks that hold CLOCKED work, which is
  // what it costs. Same shape as getWeeks(), so WeekSelector is unchanged.
  const [weeks, laborWeeks] = await Promise.all([
    getWeeks().catch(() => [] as Awaited<ReturnType<typeof getWeeks>>),
    getLabourWeeks().catch(() => [] as Awaited<ReturnType<typeof getLabourWeeks>>),
  ]);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {weeks[0] && (
        <span className="text-xs text-text-muted hidden md:block">
          Last synced: week ending {weeks[0].week_end}
        </span>
      )}
      <StoreSelector />
      <WeekSelector
        weeks={weeks}
        laborWeeks={laborWeeks}
        reportWeeks={reportWeekOptions(weeks)}
      />
    </div>
  );
}
