import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/supabase-server";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function ManagerAnalyticsPage() {
  await requireRole(["manager"]);
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cash flow trends across weeks and months."
      />
      <AnalyticsView />
    </>
  );
}
