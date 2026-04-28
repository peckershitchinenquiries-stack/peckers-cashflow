import { PageHeader } from "@/components/layout/PageHeader";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
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
