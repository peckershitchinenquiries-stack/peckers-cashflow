import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { addDays, formatDDMMYYYY, londonISODate, parseISODate, startOfISOWeek, toISODate } from "@/lib/utils";
import { payWeekOf } from "@/lib/cash-flow";
import { AdminDashboardView } from "@/components/dashboard/AdminDashboardView";
import { ddmm } from "@/components/dashboard/format";
import { LiveGrossSalesPanel } from "@/components/dashboard/LiveGrossSalesPanel";
import { loadWeekPerformance } from "@/lib/dashboard/performance";
import { buildPayoutCard, loadPayoutHeaders, loadPayoutSummary } from "@/lib/dashboard/payouts";
import { buildNeedsAction, loadNeedsActionRows } from "@/lib/dashboard/needs-action";
import type {
  DashboardStore,
  DashboardWeeks,
  PerformanceWeekOption,
  StoreDashboard,
} from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

// The server runs UTC; every date here is a UK business date, as in the alert scan.
function dashboardWeeks(): DashboardWeeks {
  const today = londonISODate(new Date());
  const shift = (iso: string, days: number) => toISODate(addDays(parseISODate(iso), days));
  const thisWeek = toISODate(startOfISOWeek(parseISODate(today)));
  const lastWeek = shift(thisWeek, -7);
  return {
    today,
    yesterday: shift(today, -1),
    thisWeek,
    lastWeek,
    weekBefore: shift(lastWeek, -7),
    nextWeek: shift(thisWeek, 7),
  };
}

/** The last 12 COMPLETED weeks, newest first. The in-progress week is excluded:
 *  the card reports a finished week, and a part-week would read as a collapse. */
function performanceWeekOptions(weeks: DashboardWeeks): PerformanceWeekOption[] {
  const out: PerformanceWeekOption[] = [];
  for (let i = 0; i < 12; i++) {
    const start = addDays(parseISODate(weeks.lastWeek), -7 * i);
    const iso = toISODate(start);
    out.push({ iso, label: `${ddmm(iso)} – ${ddmm(toISODate(addDays(start, 6)))}` });
  }
  return out;
}

/** A picked week counts only if it is one of the offered Mondays. */
function resolvePerformanceWeek(raw: string | undefined, options: PerformanceWeekOption[]): string {
  return options.some((o) => o.iso === raw) ? raw! : options[0].iso;
}

async function loadDashboard(
  perfWeekParam: string | undefined,
): Promise<{
  stores: StoreDashboard[];
  storesError: string | null;
  weekOptions: PerformanceWeekOption[];
  perfWeek: string;
}> {
  const supabase = createServerSupabase();
  const weeks = dashboardWeeks();
  const weekOptions = performanceWeekOptions(weeks);
  const perfWeek = resolvePerformanceWeek(perfWeekParam, weekOptions);

  const { data, error } = await supabase
    .from("stores")
    .select("id, code, name, vm_store_name")
    .order("name");
  if (error) return { stores: [], storesError: error.message, weekOptions, perfWeek };
  const stores = (data ?? []) as DashboardStore[];

  // Needs Action always judges the week that just ENDED — it asks what is
  // outstanding now, which browsing back through the card must not restate.
  // Same week in both places on all but a deliberate look back, so no extra
  // round trip in the normal case.
  const [perStore, headers, actionRows] = await Promise.all([
    Promise.all(
      stores.map((store) =>
        Promise.all([
          loadWeekPerformance(store, perfWeek),
          loadPayoutSummary(store.id, weeks.thisWeek),
          loadPayoutSummary(store.id, weeks.nextWeek),
          perfWeek === weeks.lastWeek ? null : loadWeekPerformance(store, weeks.lastWeek),
        ]),
      ),
    ),
    loadPayoutHeaders(supabase, weeks),
    loadNeedsActionRows(supabase, stores, weeks, payWeekOf(weeks.thisWeek).start),
  ]);

  return {
    storesError: null,
    weekOptions,
    perfWeek,
    stores: stores.map((store, i) => {
      const [performance, thisSummary, nextSummary, lastWeekPerformance] = perStore[i];
      const thisTuesday = buildPayoutCard(store, weeks.thisWeek, thisSummary, headers);
      return {
        store,
        performance,
        thisTuesday,
        nextTuesday: buildPayoutCard(store, weeks.nextWeek, nextSummary, headers),
        needsAction: buildNeedsAction(
          store,
          actionRows,
          weeks,
          lastWeekPerformance ?? performance,
          thisTuesday,
        ),
      };
    }),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const user = await requireUser();
  const { stores, storesError, weekOptions, perfWeek } = await loadDashboard(searchParams.week);
  const today = londonISODate(new Date());

  return (
    <>
      <PageHeader
        title={`Hello, ${user.allowed?.name?.split(" ")[0] || "there"}`}
        description={`Today is ${formatDDMMYYYY(today)}. Live sales, last week's results and Tuesday payouts.`}
      />

      {process.env.LIVE_SALES_ENABLED === "true" && (
        <div className="mb-5">
          <LiveGrossSalesPanel />
        </div>
      )}

      {storesError ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Couldn&apos;t load stores ({storesError}). Nothing below can be shown until this is fixed.
        </p>
      ) : (
        <AdminDashboardView
          stores={stores}
          today={today}
          weekOptions={weekOptions}
          perfWeek={perfWeek}
        />
      )}
    </>
  );
}
