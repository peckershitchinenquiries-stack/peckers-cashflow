import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { LiveDashboard } from "@/components/live/LiveDashboard";
import { todayISO } from "@/lib/utils";
import type { ClockEvent, Employee, RotaShift, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerLivePage() {
  const user = await requireRole(["manager"]);
  const storeId = user.allowed?.store_id ?? null;
  const supabase = createServerSupabase();
  const today = todayISO();

  const [storesRes, employeesRes, shiftsRes, clocksRes] = await Promise.all([
    storeId
      ? supabase.from("stores").select("*").eq("id", storeId)
      : supabase.from("stores").select("*"),
    supabase
      .from("employees")
      .select("*")
      .eq("store_id", storeId ?? "")
      .neq("employment_status", "left"),
    supabase.from("rota_shifts").select("*").eq("shift_date", today).eq("store_id", storeId ?? ""),
    supabase.from("clock_events").select("*").eq("event_date", today).eq("store_id", storeId ?? ""),
  ]);

  return (
    <>
      <PageHeader
        title="Live Dashboard"
        description="Real-time staffing for your store today. Refreshes automatically."
      />
      <LiveDashboard
        stores={(storesRes.data ?? []) as Store[]}
        employees={(employeesRes.data ?? []) as Employee[]}
        shifts={(shiftsRes.data ?? []) as RotaShift[]}
        clocks={(clocksRes.data ?? []) as ClockEvent[]}
        userRole="manager"
        userStoreId={storeId}
      />
    </>
  );
}
