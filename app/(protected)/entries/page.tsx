import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { EntriesView } from "@/components/entries/EntriesView";

export const dynamic = "force-dynamic";

export default async function EntriesPage() {
  const user = (await getSessionUser())!;
  const supabase = createServerSupabase();

  const [entriesRes, allowedRes] = await Promise.all([
    supabase
      .from("cash_entries")
      .select("id, entry_date, cash_sales, supermarket_expenses, notes, user_id, user_email, created_at, updated_at")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("allowed_users").select("email, name"),
  ]);

  const allowedUsers = (allowedRes.data ?? []).map((u) => ({
    email: u.email,
    name: u.name ?? u.email,
  }));

  const allowedMap = new Map<string, string>();
  for (const u of allowedUsers) allowedMap.set(u.email.toLowerCase(), u.name);

  const entries = (entriesRes.data ?? []).map((r) => ({
    ...r,
    manager_name:
      (r.user_email && allowedMap.get(r.user_email.toLowerCase())) ||
      r.user_email ||
      "—",
  }));

  return (
    <>
      <PageHeader
        title="Entries"
        description="All cash entries across managers."
      />
      <EntriesView
        initialEntries={entries}
        managers={allowedUsers}
        currentUserId={user.id}
        currentUserEmail={user.email}
        isAdmin={user.allowed?.role === "admin"}
      />
    </>
  );
}
