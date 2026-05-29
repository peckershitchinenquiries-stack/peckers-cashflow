import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import {
  addDays,
  endOfISOWeek,
  formatDDMMYYYY,
  startOfISOWeek,
  todayISO,
  toISODate,
} from "@/lib/utils";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { QuickEntryForm } from "@/components/dashboard/QuickEntryForm";
import { RecentEntriesTable } from "@/components/dashboard/RecentEntriesTable";

export const dynamic = "force-dynamic";

async function loadDashboardData(userId: string) {
  const supabase = createServerSupabase();
  const today = todayISO();
  const weekStart = toISODate(startOfISOWeek(new Date()));
  const weekEnd = toISODate(endOfISOWeek(new Date()));
  const sevenDaysAgo = toISODate(addDays(new Date(), -6));

  const [
    todayEntryRes,
    todayTotalsRes,
    weekEntriesRes,
    weekHoursRes,
    recentRes,
    allowedRes,
    alertsRes,
  ] = await Promise.all([
    supabase
      .from("cash_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("entry_date", today)
      .maybeSingle(),
    supabase
      .from("cash_entries")
      .select("cash_sales, supermarket_expenses")
      .eq("entry_date", today),
    supabase
      .from("cash_entries")
      .select("cash_sales, supermarket_expenses, entry_date")
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd),
    supabase
      .from("employee_hours_computed")
      .select("cash_amount_due, week_start_date")
      .eq("week_start_date", weekStart),
    supabase
      .from("cash_entries")
      .select("id, entry_date, cash_sales, supermarket_expenses, notes, user_id, user_email, created_at")
      .gte("entry_date", sevenDaysAgo)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("allowed_users").select("email, name"),
    supabase
      .from("alerts")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const allowedMap = new Map<string, string | null>();
  for (const u of allowedRes.data ?? []) {
    allowedMap.set(u.email.toLowerCase(), u.name ?? null);
  }

  return {
    todayEntry: todayEntryRes.data ?? null,
    todayTotals: todayTotalsRes.data ?? [],
    weekEntries: weekEntriesRes.data ?? [],
    weekHours: weekHoursRes.data ?? [],
    recent: recentRes.data ?? [],
    allowedMap,
    openAlerts: alertsRes.data ?? [],
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await loadDashboardData(user.id);

  const todaySales = data.todayTotals.reduce((s, r) => s + Number(r.cash_sales || 0), 0);
  const todayExp = data.todayTotals.reduce((s, r) => s + Number(r.supermarket_expenses || 0), 0);
  const todayNet = todaySales - todayExp;

  const weekSales = data.weekEntries.reduce((s, r) => s + Number(r.cash_sales || 0), 0);
  const weekExp = data.weekEntries.reduce((s, r) => s + Number(r.supermarket_expenses || 0), 0);
  const weekEmpCash = data.weekHours.reduce((s, r) => s + Number(r.cash_amount_due || 0), 0);
  const weekNet = weekSales - weekExp - weekEmpCash;

  const recentRows = data.recent.map((r) => ({
    ...r,
    manager_name:
      (r.user_email && data.allowedMap.get(r.user_email.toLowerCase())) ||
      r.user_email ||
      "—",
  }));

  return (
    <>
      <PageHeader
        title={`Hello, ${user.allowed?.name?.split(" ")[0] || "there"}`}
        description={`Today is ${formatDDMMYYYY(new Date())}. Here's your cash flow at a glance.`}
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
        todaySales={todaySales}
        todayExp={todayExp}
        todayNet={todayNet}
        weekNet={weekNet}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-6">
        <div className="lg:col-span-2">
          <QuickEntryForm existing={data.todayEntry} today={todayISO()} />
        </div>
        <div className="lg:col-span-3">
          <RecentEntriesTable rows={recentRows} currentUserId={user.id} />
        </div>
      </div>
    </>
  );
}
