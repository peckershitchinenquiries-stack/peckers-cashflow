import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { addDays, formatDDMMYYYY, londonISODate, parseISODate, startOfISOWeek, toISODate } from "@/lib/utils";
import { payWeekOf } from "@/lib/cash-flow";
import { AdminDashboardView } from "@/components/dashboard/AdminDashboardView";
import { LiveGrossSalesPanel } from "@/components/dashboard/LiveGrossSalesPanel";
import { loadLastWeekPerformance } from "@/lib/dashboard/performance";
import { buildPayoutCard, loadPayoutHeaders, loadPayoutSummary } from "@/lib/dashboard/payouts";
import { buildNeedsAction, loadNeedsActionRows } from "@/lib/dashboard/needs-action";
import type { DashboardStore, DashboardWeeks, StoreDashboard } from "@/lib/dashboard/types";

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

async function loadDashboard(): Promise<{ stores: StoreDashboard[]; storesError: string | null }> {
  const supabase = createServerSupabase();
  const weeks = dashboardWeeks();

  const { data, error } = await supabase
    .from("stores")
    .select("id, code, name, vm_store_name")
    .order("name");
  if (error) return { stores: [], storesError: error.message };
  const stores = (data ?? []) as DashboardStore[];

  const [perStore, headers, actionRows] = await Promise.all([
    Promise.all(
      stores.map((store) =>
        Promise.all([
          loadLastWeekPerformance(store, weeks),
          loadPayoutSummary(store.id, weeks.thisWeek),
          loadPayoutSummary(store.id, weeks.nextWeek),
        ]),
      ),
    ),
    loadPayoutHeaders(supabase, weeks),
    loadNeedsActionRows(supabase, stores, weeks, payWeekOf(weeks.thisWeek).start),
  ]);

  return {
    storesError: null,
    stores: stores.map((store, i) => {
      const [performance, thisSummary, nextSummary] = perStore[i];
      const thisTuesday = buildPayoutCard(store, weeks.thisWeek, thisSummary, headers);
      return {
        store,
        performance,
        thisTuesday,
        nextTuesday: buildPayoutCard(store, weeks.nextWeek, nextSummary, headers),
        needsAction: buildNeedsAction(store, actionRows, weeks, performance, thisTuesday),
      };
    }),
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { stores, storesError } = await loadDashboard();
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
        <AdminDashboardView stores={stores} today={today} />
      )}
    </>
  );
}
