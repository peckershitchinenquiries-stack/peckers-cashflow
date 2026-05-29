import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { EntriesView } from "@/components/entries/EntriesView";

export const dynamic = "force-dynamic";

export default async function ManagerEntriesPage() {
  const user = await requireRole(["manager"]);
  const supabase = createServerSupabase();

  // Managers see and manage their own cash entries.
  const entriesRes = await supabase
    .from("cash_entries")
    .select("id, entry_date, cash_sales, supermarket_expenses, notes, user_id, user_email, created_at, updated_at")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  const myName = user.allowed?.name ?? user.email;
  const entries = (entriesRes.data ?? []).map((r) => ({
    ...r,
    manager_name: myName,
  }));

  return (
    <>
      <PageHeader title="Cash Entries" description="Your daily cash sales and expenses." />
      <EntriesView
        initialEntries={entries}
        managers={[{ email: user.email, name: myName }]}
        currentUserId={user.id}
        currentUserEmail={user.email}
        isAdmin={false}
      />
    </>
  );
}
