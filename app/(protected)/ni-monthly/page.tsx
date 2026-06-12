import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { loadNiRows } from "@/lib/ni-data";
import { NiMonthlyView } from "@/components/ni/NiMonthlyView";

export const dynamic = "force-dynamic";

export default async function NiMonthlyPage() {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();

  const [{ data: stores }, rows] = await Promise.all([
    supabase.from("stores").select("id, name").order("name"),
    loadNiRows(),
  ]);

  return (
    <>
      <PageHeader
        title="NI — Monthly Summary"
        description="National Insurance (PAYE) wages grouped by calendar month, per store. NI is paid monthly; cash is paid weekly on the Saturday payout."
      />
      <NiMonthlyView rows={rows} stores={stores ?? []} isAdmin />
    </>
  );
}
