import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import {
  addDays,
  endOfISOWeek,
  formatDDMMYYYY,
  startOfISOWeek,
  toISODate,
} from "@/lib/utils";
import { buildDashboardViews } from "@/lib/cash-flow-data";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { RecentEntriesTable } from "@/components/dashboard/RecentEntriesTable";

export const dynamic = "force-dynamic";

type RecentRow = {
  id: string;
  entry_date: string;
  vita_mojo_sales: number;
  supermarket_expenses: number;
  difference: number;
  is_late: boolean;
  stores: { name: string | null } | null;
};

async function loadDashboardData() {
  const supabase = createServerSupabase();
  const yesterday = toISODate(addDays(new Date(), -1));
  const weekStart = toISODate(startOfISOWeek(new Date()));
  const weekEnd = toISODate(endOfISOWeek(new Date()));
  const sevenDaysAgo = toISODate(addDays(new Date(), -6));

  const { data: stores } = await supabase.from("stores").select("id, name").order("name");

  const [views, yesterdayRes, recentRes, alertsRes] = await Promise.all([
    buildDashboardViews(stores ?? [], weekStart),
    supabase
      .from("daily_cash_entries")
      .select("vita_mojo_sales, supermarket_expenses")
      .eq("entry_date", yesterday),
    supabase
      .from("daily_cash_entries")
      .select("id, entry_date, vita_mojo_sales, supermarket_expenses, difference, is_late, stores(name)")
      .gte("entry_date", sevenDaysAgo)
      .lte("entry_date", weekEnd)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("alerts")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Remaining cash in hand = sum of each store's running balance this week.
  const remainingCash = views.reduce((s, v) => s + v.runningBalance, 0);
  // This week's cash = total Vita Mojo cash sales across stores this week.
  const weekCash = views.reduce(
    (s, v) => s + v.rows.reduce((t, r) => t + Number(r.vita_mojo_sales || 0), 0),
    0,
  );

  const yesterdaySales = (yesterdayRes.data ?? []).reduce(
    (s, r) => s + Number(r.vita_mojo_sales || 0),
    0,
  );
  const yesterdayExp = (yesterdayRes.data ?? []).reduce(
    (s, r) => s + Number(r.supermarket_expenses || 0),
    0,
  );

  const recent = ((recentRes.data ?? []) as unknown as RecentRow[]).map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    store_name: r.stores?.name ?? null,
    vita_mojo_sales: Number(r.vita_mojo_sales || 0),
    supermarket_expenses: Number(r.supermarket_expenses || 0),
    difference: Number(r.difference || 0),
    is_late: !!r.is_late,
  }));

  return {
    yesterday,
    yesterdaySales,
    yesterdayExp,
    remainingCash,
    weekCash,
    recent,
    openAlerts: alertsRes.data ?? [],
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await loadDashboardData();

  // Short "12/06" label for yesterday.
  const yLabel = formatDDMMYYYY(data.yesterday).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.allowed?.name?.split(" ")[0] || "there"}`}
        description={`Today is ${formatDDMMYYYY(new Date())}. Yesterday's figures (${formatDDMMYYYY(data.yesterday)}) and this week's cash at a glance.`}
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

      <SummaryCards
        yesterdaySales={data.yesterdaySales}
        yesterdayExp={data.yesterdayExp}
        remainingCash={data.remainingCash}
        weekCash={data.weekCash}
        yesterdayLabel={yLabel}
      />

      <div className="mt-6">
        <RecentEntriesTable rows={data.recent} />
      </div>
    </>
  );
}
