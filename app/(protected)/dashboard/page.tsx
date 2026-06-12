import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { addDays, formatDDMMYYYY, startOfISOWeek, toISODate } from "@/lib/utils";
import {
  AdminDashboardView,
  type StoreDashboardData,
} from "@/components/dashboard/AdminDashboardView";
import type { DailyCashEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

type EntryRow = DailyCashEntry & { stores: { name: string | null } | null };

// The dashboard never shows today's figures — everything is yesterday or
// earlier, and each store is kept completely separate (toggle, no combining).
async function loadDashboardData() {
  const supabase = createServerSupabase();
  const today = toISODate(new Date());
  const yesterday = toISODate(addDays(new Date(), -1));
  // Stat cards are anchored to YESTERDAY, but the Recent Entries table shows
  // every record up to and including TODAY so a same-day entry is visible.
  const weekStart = toISODate(startOfISOWeek(addDays(new Date(), -1)));
  const sevenDaysAgo = toISODate(addDays(new Date(), -6));
  const rangeStart = sevenDaysAgo < weekStart ? sevenDaysAgo : weekStart;

  const [storesRes, entriesRes, alertsRes] = await Promise.all([
    supabase.from("stores").select("id, name").order("name"),
    supabase
      .from("daily_cash_entries")
      .select("*, stores(name)")
      .gte("entry_date", rangeStart)
      .lte("entry_date", today)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stores = storesRes.data ?? [];
  const entries = (entriesRes.data ?? []) as EntryRow[];

  const storeData: StoreDashboardData[] = stores.map((store) => {
    const storeEntries = entries.filter((e) => e.store_id === store.id);
    const yest = storeEntries.filter((e) => e.entry_date === yesterday);
    const cashSale = yest.reduce((s, e) => s + Number(e.vita_mojo_sales || 0), 0);
    const expenses = yest.reduce((s, e) => s + Number(e.supermarket_expenses || 0), 0);
    const weekCash = storeEntries
      .filter((e) => e.entry_date >= weekStart && e.entry_date <= yesterday)
      .reduce((s, e) => s + Number(e.vita_mojo_sales || 0), 0);

    return {
      store,
      cashSale,
      expenses,
      remainingCash: cashSale - expenses,
      weekCash,
      recent: storeEntries.slice(0, 25).map((e) => ({
        id: e.id,
        entry_date: e.entry_date,
        store_name: e.stores?.name ?? null,
        manager_name: e.edited_by_name ?? e.submitted_by_name ?? null,
        vita_mojo_sales: Number(e.vita_mojo_sales || 0),
        supermarket_expenses: Number(e.supermarket_expenses || 0),
        difference: Number(e.difference || 0),
        is_late: !!e.is_late,
      })),
    };
  });

  return { yesterday, storeData, openAlerts: alertsRes.data ?? [] };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await loadDashboardData();

  // Short "10/06" label for yesterday.
  const yLabel = formatDDMMYYYY(data.yesterday).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.allowed?.name?.split(" ")[0] || "there"}`}
        description={`Today is ${formatDDMMYYYY(new Date())}. Showing yesterday's figures (${formatDDMMYYYY(data.yesterday)}) per store.`}
      />

      {data.openAlerts.length > 0 && (
        <a
          href="/alerts"
          className="block mb-5 rounded-2xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm hover:bg-warning/15 transition-colors"
        >
          <span className="font-medium text-warning">
            {data.openAlerts.length} open alert{data.openAlerts.length === 1 ? "" : "s"}
          </span>
          <span className="text-text-subtle ml-2">
            — {data.openAlerts[0].title}
            {data.openAlerts.length > 1 && ` and ${data.openAlerts.length - 1} more`}
          </span>
        </a>
      )}

      <AdminDashboardView storeData={data.storeData} yesterdayLabel={yLabel} />
    </>
  );
}
