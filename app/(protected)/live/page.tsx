import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireUser } from "@/lib/supabase-server";
import { LiveDashboard } from "@/components/live/LiveDashboard";
import { todayISO } from "@/lib/utils";
import type {
  ClockEvent,
  Employee,
  RotaShift,
  Store,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const user = await requireUser();
  const supabase = createServerSupabase();
  const today = todayISO();

  const [storesRes, employeesRes, shiftsRes, clocksRes] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase
      .from("employees")
      .select("*")
      .neq("employment_status", "left"),
    supabase.from("rota_shifts").select("*").eq("shift_date", today),
    supabase.from("clock_events").select("*").eq("event_date", today),
  ]);

  return (
    <>
      <PageHeader
        title="Live Daily Dashboard"
        description="Real-time staffing for today across both stores. Refreshes every 2 minutes."
      />
      <LiveDashboard
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
        shifts={(shiftsRes.data ?? []) as RotaShift[]}
        clocks={(clocksRes.data ?? []) as ClockEvent[]}
        userRole={user.allowed?.role ?? "manager"}
        userStoreId={user.allowed?.store_id ?? null}
      />
    </>
  );
}
