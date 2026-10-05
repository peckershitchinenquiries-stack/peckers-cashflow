import { PageHeader } from "@/components/layout/PageHeader";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { hasRole, resolveActiveStoreId } from "@/lib/types";
import { EmployeesView } from "@/components/employees/EmployeesView";
import { getAppSettings } from "@/app/actions/settings";
import { addDays, mapClockEventsToDaily, startOfISOWeek, toISODate, todayISO } from "@/lib/utils";
import { summariseCoverDriverDays } from "@/lib/cover-driver-hours";
import { mapManagerDaysToApproval } from "@/lib/manager-clock-sessions";
import type {
  CoverDriver,
  CoverDriverClockEvent,
  Employee,
  EmployeeSummary,
  EntryEmployeeDay,
  ManagerClockEvent,
  ManagerClockSession,
} from "@/lib/types";

type EntryEmployee = Pick<Employee, "id" | "name" | "position" | "store_id">;

export const dynamic = "force-dynamic";

// Daily Approval needs identity, store and rates — nothing
// else. The full profile is loaded by the Employees tab that renders it.
const APPROVAL_EMPLOYEE_COLUMNS =
  "id, name, position, store_id, employment_status, is_active, hourly_rate, hourly_ni_rate";

const CLOCK_EVENT_COLUMNS =
  "id, employee_id, store_id, event_date, clock_in_at, clock_out_at, worked_hours, session_count, hours_approved, approved_hours, auto_clocked_out, manual_entry, manual_entry_reason, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, extra_short_reason, extra_long_reason";

const SESSION_COLUMNS =
  "id, clock_event_id, store_id, seq, clock_in_at, clock_out_at, clock_out_lat, clock_out_lng, auto_clocked_out, manual_entry, hours_approved, approved_hours, short_deliveries_count, long_deliveries_count, extra_short_deliveries, extra_long_deliveries, extra_short_reason, extra_long_reason";

export default async function ManagerEmployeesPage() {
  const user = await requireRole(["manager"]);
  const storeId = resolveActiveStoreId(user.allowed) ?? "";
  const supabase = createServerSupabase();
  const settings = await getAppSettings();

  const eightWeeksBack = toISODate(addDays(startOfISOWeek(new Date()), -56));

  const [
    empRes,
    entryEmpRes,
    entryDaysRes,
    storesRes,
    allStoresRes,
    clocksRes,
    sessionsRes,
    coverDriversRes,
    coverClocksRes,
    coverHoursRes,
    managersRes,
    managerClocksRes,
    managerSessionsRes,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select(APPROVAL_EMPLOYEE_COLUMNS)
      .eq("store_id", storeId)
      .order("employment_status")
      .order("name"),
    // The whole estate's staff. Two things need it. The missed-entry picker
    // must reach someone based at the other store who covered a shift here, and
    // the approval rows must be able to NAME and RATE them — a clock row
    // is filed under the store the shift happened at, so a visitor's day lands
    // on this screen while they are absent from the roster above. Display stays
    // scoped to storeId; only the identity lookup is estate-wide.
    supabase
      .from("employees")
      .select(APPROVAL_EMPLOYEE_COLUMNS)
      .order("name"),
    // The days those people already have recorded at their OWN store, over the
    // same window this screen navigates. Without them a visiting employee reads
    // as having worked nothing that day, and the modal cannot warn that saving
    // here moves the WHOLE day onto this store's payout. Non-sensitive columns
    // only — no hours, no rates, no delivery counts.
    supabase
      .from("clock_events")
      .select("employee_id, event_date, store_id, session_count, clock_in_at")
      .neq("store_id", storeId)
      .gte("event_date", eightWeeksBack),
    supabase.from("stores").select("*").eq("id", storeId),
    // Name and geofence for every store, so the missed-entry modal can say
    // which store a visitor is based at and Daily Approval can name the other
    // half of a cross-store day and tell where a shift was clocked OUT.
    // Coordinates are not payroll data; the rest of the page stays scoped to
    // `stores` above.
    supabase
      .from("stores")
      .select("id, name, latitude, longitude, geofence_radius_m")
      .order("name"),
    supabase
      .from("clock_events")
      .select(CLOCK_EVENT_COLUMNS)
      .eq("store_id", storeId)
      .gte("event_date", eightWeeksBack)
      .not("clock_out_at", "is", null)
      .order("event_date", { ascending: false }),
    // The individual shifts inside those days, for the shifts worked HERE. A
    // day can hold several, and the approval row lists them under the total it
    // is signing off. The days these reach that the header query misses — a
    // morning here, an evening at the other store — are pulled in below.
    supabase
      .from("clock_sessions")
      .select(SESSION_COLUMNS)
      .eq("store_id", storeId)
      .gte("event_date", eightWeeksBack)
      .order("clock_in_at", { ascending: true }),
    supabase.from("cover_drivers").select("*").eq("store_id", storeId).order("name"),
    supabase
      .from("cover_driver_clock_events")
      .select("*")
      .eq("store_id", storeId)
      .gte("event_date", eightWeeksBack)
      .not("clock_out_at", "is", null)
      .order("event_date", { ascending: false }),
    supabase
      .from("cover_driver_hours_computed")
      .select("*")
      .eq("store_id", storeId)
      .order("work_date", { ascending: false })
      .limit(500),
    // Managers at THIS store, and their clocked days. A manager may sign off a
    // peer's drops as well as their own — the client's explicit call, since the
    // people covering a busy night are the ones who saw it happen.
    supabase.from("allowed_users").select("id, name").eq("role", "manager"),
    supabase
      .from("manager_clock_events")
      .select("*")
      .gte("event_date", eightWeeksBack)
      .order("event_date", { ascending: false }),
    // The shifts behind those days. A manager can cover a round at EACH store
    // on one date (migration 061), and the header names only the last shift's
    // store — so which store's screen lists the day is decided from these.
    supabase
      .from("manager_clock_sessions")
      .select("*")
      .gte("event_date", eightWeeksBack),
  ]);

  const employees = (empRes.data ?? []) as unknown as EmployeeSummary[];
  const estateEmployees = (entryEmpRes.data ?? []) as unknown as EmployeeSummary[];
  // Keyed over the ESTATE, not this store's roster. A miss here doesn't just
  // blank the name — it also loses `is_driver`, so the row renders with no
  // delivery inputs.
  const empMap = new Map(
    estateEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      hourly_ni_rate: e.hourly_ni_rate,
      hourly_rate: e.hourly_rate,
      // Only a Driver earns the per-delivery allowance, so only their approval
      // row offers delivery inputs.
      is_driver: hasRole(e.position, "Driver"),
    })).map((e) => [e.id, e]),
  );
  // A failed clock query must not read as "nobody worked" on a payroll screen.
  if (clocksRes.error) {
    console.error("[manager/employees] clock_events query failed:", clocksRes.error.message);
  }

  type SessionRow = NonNullable<typeof sessionsRes.data>[number];
  type ClockEventRow = NonNullable<typeof clocksRes.data>[number];

  const clockEvents: ClockEventRow[] = [...(clocksRes.data ?? [])];
  const ownSessions: SessionRow[] = [...(sessionsRes.data ?? [])];

  // A day worked at two stores has ONE header, carrying the store of its LAST
  // shift (Update 98). Scoped to this store's headers alone, a morning worked
  // here that ended at the other store was invisible on this screen — the
  // hours unapprovable, and so unpayable, by anyone (Update 224). Two narrow
  // follow-ups fix that without widening the estate's payroll to every
  // manager:
  //   · the headers our own shifts point at but the header query didn't return
  //   · every shift of the days that can be cross-store — the ones just found,
  //     plus any day here holding more than one shift
  // A single-shift day whose header is ours cannot be cross-store, so the vast
  // majority of days need neither.
  const headerIds = new Set(clockEvents.map((e) => e.id));
  const crossStoreEventIds = Array.from(
    new Set(
      ownSessions.map((s) => s.clock_event_id).filter((id) => id && !headerIds.has(id)),
    ),
  );
  const multiShiftEventIds = clockEvents
    .filter((e) => (e.session_count ?? 1) > 1)
    .map((e) => e.id);
  const needAllShifts = Array.from(
    new Set([...crossStoreEventIds, ...multiShiftEventIds]),
  );

  const [crossHeadersRes, crossSessionsRes] = await Promise.all([
    crossStoreEventIds.length > 0
      ? supabase
          .from("clock_events")
          .select(CLOCK_EVENT_COLUMNS)
          .in("id", crossStoreEventIds)
          .not("clock_out_at", "is", null)
      : Promise.resolve({ data: [], error: null }),
    needAllShifts.length > 0
      ? supabase
          .from("clock_sessions")
          .select(SESSION_COLUMNS)
          .in("clock_event_id", needAllShifts)
          .order("clock_in_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (crossHeadersRes.error || crossSessionsRes.error) {
    console.error(
      "[manager/employees] cross-store clock query failed:",
      crossHeadersRes.error?.message ?? crossSessionsRes.error?.message,
    );
  }
  clockEvents.push(...((crossHeadersRes.data ?? []) as ClockEventRow[]));

  // Shifts keyed by the day they belong to, so an approval row can show the
  // windows that make up its total. A cross-store day's set REPLACES the
  // this-store-only one: a half-day breakdown reads as a day someone worked
  // half of, which is exactly the bug being fixed.
  const sessionsByEvent = new Map<string, SessionRow[]>();
  for (const s of ownSessions) {
    const arr = sessionsByEvent.get(s.clock_event_id) ?? [];
    arr.push(s);
    sessionsByEvent.set(s.clock_event_id, arr);
  }
  const fullSets = new Map<string, SessionRow[]>();
  for (const s of (crossSessionsRes.data ?? []) as SessionRow[]) {
    const arr = fullSets.get(s.clock_event_id) ?? [];
    arr.push(s);
    fullSets.set(s.clock_event_id, arr);
  }
  for (const [eventId, rows] of fullSets) sessionsByEvent.set(eventId, rows);

  const clockDailySummaries = mapClockEventsToDaily(
    clockEvents,
    empMap,
    sessionsByEvent,
  );

  // Cover drivers are summarised per DAY, not per week — each cover shift is a
  // discrete engagement that is approved and paid on its own.
  const coverDrivers = (coverDriversRes.data ?? []) as CoverDriver[];
  const coverDriverDays = summariseCoverDriverDays(
    (coverClocksRes.data ?? []) as CoverDriverClockEvent[],
    coverDrivers,
  );

  // Active staff only, projected back to the four columns the picker needs —
  // the rates the map above uses are server-side and stay there.
  const entryPickerEmployees: EntryEmployee[] = estateEmployees
    .filter((e) => e.employment_status === "active")
    .map((e) => ({
      id: e.id,
      name: e.name,
      position: e.position,
      store_id: e.store_id,
    }));

  const managerAccounts = (managersRes.data ?? []).map((m) => ({
    id: m.id as string,
    name: (m.name as string) ?? "Manager",
  }));
  const managerNames = new Map(managerAccounts.map((m) => [m.id, m.name]));
  const managerSessionsByEvent = new Map<string, ManagerClockSession[]>();
  for (const s of (managerSessionsRes.data ?? []) as ManagerClockSession[]) {
    const arr = managerSessionsByEvent.get(s.clock_event_id) ?? [];
    arr.push(s);
    managerSessionsByEvent.set(s.clock_event_id, arr);
  }
  const managerDaily = mapManagerDaysToApproval(
    (managerClocksRes.data ?? []) as ManagerClockEvent[],
    managerNames,
    managerSessionsByEvent,
  );

  return (
    <>
      <PageHeader
        title="Employees"
        description="Your store's staff. New employees get an auto-generated crew login."
      />
      <EmployeesView
        initialEmployees={employees}
        coverDrivers={coverDrivers}
        coverDriverDays={coverDriverDays}
        coverDriverHours={(coverHoursRes.data ?? []) as any[]}
        clockDailySummaries={clockDailySummaries}
        managerDaily={managerDaily}
        managers={managerAccounts}
        loadError={
          clocksRes.error?.message ??
          sessionsRes.error?.message ??
          crossHeadersRes.error?.message ??
          crossSessionsRes.error?.message ??
          null
        }
        todayISO={todayISO()}
        stores={storesRes.data ?? []}
        entryStores={allStoresRes.data ?? []}
        entryEmployees={entryPickerEmployees}
        entryEmployeeDays={(entryDaysRes.data ?? []) as EntryEmployeeDay[]}
        defaultStoreId={storeId || null}
        minWageBands={settings.min_wage_bands}
        lockToStore
        canEditContactEmail={false}
      />
    </>
  );
}
