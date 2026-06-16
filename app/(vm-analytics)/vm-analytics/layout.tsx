import { Suspense } from "react";
import { DashboardSelector } from "@/components/vm-analytics/nav/DashboardSelector";
import { WeekSelector } from "@/components/vm-analytics/nav/WeekSelector";
import { StoreSelector } from "@/components/vm-analytics/nav/StoreSelector";
import { getWeeks, getLaborCostWeeks } from "@/lib/vm-analytics/queries";

export default async function VmAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let weeks = [] as Awaited<ReturnType<typeof getWeeks>>;
  try {
    weeks = await getWeeks();
  } catch {
    weeks = [];
  }

  // Labor Cost dashboard uses the cashflow Supabase, which has its own set of
  // available weeks. Fetch them so the week picker shows the right options on
  // that dashboard. A failure here must not break the other dashboards.
  let laborWeeks = [] as Awaited<ReturnType<typeof getLaborCostWeeks>>;
  try {
    laborWeeks = await getLaborCostWeeks();
  } catch {
    laborWeeks = [];
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr] bg-bg">
      {/* Sidebar — the VM Analytics module lives here */}
      <aside className="border-b border-border bg-surface px-5 py-5 lg:border-b-0 lg:border-r">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-sm font-bold text-white">
            P
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary">Peckers</div>
            <div className="text-xs text-text-muted">Analytics Suite</div>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-text-muted">Loading…</div>}>
          <DashboardSelector />
        </Suspense>

        <p className="mt-4 text-xs leading-relaxed text-text-muted">
          Select a dashboard from the VM Analytics menu above. Use the week
          picker (top-right) to change the reporting week.
        </p>
      </aside>

      {/* Main content */}
      <div className="flex flex-col bg-bg">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-muted">VM Analytics</span>
            {weeks[0] && (
              <span className="text-xs text-text-muted opacity-60">
                Last synced: week ending {weeks[0].week_end}
              </span>
            )}
          </div>
          <Suspense fallback={null}>
            <div className="flex items-center gap-4">
              <StoreSelector />
              <WeekSelector weeks={weeks} laborWeeks={laborWeeks} />
            </div>
          </Suspense>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
