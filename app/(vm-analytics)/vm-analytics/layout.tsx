import { Suspense } from "react";
import { DashboardSelector } from "@/components/vm-analytics/nav/DashboardSelector";
import { WeekSelector } from "@/components/vm-analytics/nav/WeekSelector";
import { getWeeks } from "@/lib/vm-analytics/queries";

export default async function VmAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let weeks = [] as Awaited<ReturnType<typeof getWeeks>>;
  let weeksError: string | null = null;
  try {
    weeks = await getWeeks();
  } catch (e) {
    weeksError = e instanceof Error ? e.message : "Failed to load weeks";
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
          <span className="text-sm font-medium text-text-muted">
            VM Analytics
          </span>
          <Suspense fallback={null}>
            {weeksError ? (
              <span className="text-sm text-rose-600">{weeksError}</span>
            ) : (
              <WeekSelector weeks={weeks} />
            )}
          </Suspense>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
