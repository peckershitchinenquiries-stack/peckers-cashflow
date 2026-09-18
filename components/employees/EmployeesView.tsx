"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { EmployeeCard } from "./EmployeeCard";
import { EmployeeDetailModal } from "./EmployeeDetailModal";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EditEmployeeModal } from "./EditEmployeeModal";
import { ScheduleEditModal } from "./ScheduleEditModal";
import { DailyHoursApproval, type DeliveryEdit } from "./DailyHoursApproval";
import {
  StaffWeekSummary,
  emptyStaffWeekCache,
  type StaffWeekCache,
} from "./StaffWeekSummary";
import { CoverDriversCard } from "@/components/cover-drivers/CoverDriversCard";
import { CoverDriverHoursTable } from "@/components/cover-drivers/CoverDriverHoursTable";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsersIcon } from "@/components/ui/icons";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Input";
import {
  approveDailyHours,
  approveDailyHoursForDate,
  loadEmployeeDirectory,
  setShiftApproval,
  unapproveDailyHours,
} from "@/app/actions/employees";
import {
  approveCoverDriverDay,
  approveCoverDriverDaysForDate,
  deleteCoverDriverHours,
} from "@/app/actions/cover-drivers";
import {
  approveManagerDeliveries,
  unapproveManagerDeliveries,
} from "@/app/actions/manager-clock";
import { mergeCoverDailyApproval } from "@/lib/cover-driver-hours";
import { hasRole } from "@/lib/types";
import type {
  ClockDailySummary,
  CoverDriver,
  CoverDriverDaySummary,
  CoverDriverHoursComputed,
  Employee,
  EntryEmployeeDay,
  EmployeeSummary,
  ManagerDailyApprovalRow,
  Store,
} from "@/lib/types";
import type { MinWageBands } from "@/lib/settings";

/**
 * The approval screen's edit shape → the server actions' delivery shape. Cover
 * driver and manager corrections are whole-day totals, so every field is sent;
 * a missing one would be read as zero and erase a count nobody touched.
 */
function toDeliveryInput(d: DeliveryEdit) {
  return {
    short_deliveries_count: d.short ?? 0,
    long_deliveries_count: d.long ?? 0,
    extra_short_deliveries: d.extraShort ?? 0,
    extra_long_deliveries: d.extraLong ?? 0,
    extra_short_reason: d.extraShortReason ?? null,
    extra_long_reason: d.extraLongReason ?? null,
  };
}

type Props = {
  /** Identity/store/rates only. Full profiles load with the Employees tab. */
  initialEmployees: EmployeeSummary[];
  /** Cover drivers are a separate module — they share this page, nothing else. */
  coverDrivers?: CoverDriver[];
  coverDriverDays?: CoverDriverDaySummary[];
  coverDriverHours?: CoverDriverHoursComputed[];
  clockDailySummaries?: ClockDailySummary[];
  /**
   * Manager days carrying deliveries. Managers are not employees and none of
   * their salary flows through here — only the drops they covered, which are
   * paid per drop like anyone else's.
   */
  managerDaily?: ManagerDailyApprovalRow[];
  /**
   * Manager login accounts, for recording drops a manager covered on a day they
   * never clocked in. Separate from managerDaily, which only holds days that
   * already carry counts.
   */
  managers?: Array<{ id: string; name: string }>;
  /** Server's "today" as YYYY-MM-DD (avoids client/server timezone drift). */
  todayISO: string;
  stores: Store[];
  defaultStoreId?: string | null;
  /**
   * Active staff based at the OTHER stores, for the missed-entry picker only —
   * never for the roster or the approval rows. Staff
   * cross-cover, so the person who forgot to clock here may be based elsewhere.
   * Passed by the manager portal, where `initialEmployees` is one store's own.
   */
  entryEmployees?: Array<Pick<Employee, "id" | "name" | "position" | "store_id">>;
  /**
   * The days those people already have recorded at their own store, so the
   * missed-entry modal can warn that saving here MOVES the whole day. Only the
   * manager portal needs it — an admin's `clockDailySummaries` already span
   * every store.
   */
  entryEmployeeDays?: EntryEmployeeDay[];
  /**
   * Every store's name, so the missed-entry modal can say WHICH store someone
   * is visiting from. The manager portal's `stores` holds only their own.
   */
  entryStores?: Array<{ id: string; name: string }>;
  minWageBands?: MinWageBands;
  /**
   * A failed data query, surfaced instead of swallowed. An empty approval list
   * is indistinguishable from "nobody worked" — on a payroll screen that has to
   * read as broken, not as zero.
   */
  loadError?: string | null;
  /** Manager portal: lock everything to a single store, hide cross-store UI. */
  lockToStore?: boolean;
  /**
   * Whether an existing employee's password-reset email can be changed here.
   * False in the manager portal: controlling that address means being able to
   * request a reset link and sign in as that person, which is admin-only
   * (see writeContactEmail in app/actions/employees.ts). Managers still set it
   * when CREATING crew, where they already see the generated password anyway.
   */
  canEditContactEmail?: boolean;
};

type TabId = "daily" | "people" | "summary";

export function EmployeesView({
  initialEmployees,
  coverDrivers = [],
  coverDriverDays = [],
  coverDriverHours = [],
  clockDailySummaries = [],
  managerDaily = [],
  managers = [],
  loadError = null,
  todayISO,
  stores,
  defaultStoreId,
  entryEmployees = [],
  entryEmployeeDays = [],
  entryStores,
  minWageBands,
  lockToStore = false,
  canEditContactEmail = true,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("daily");
  const [showAdd, setShowAdd] = React.useState(false);
  const [viewing, setViewing] = React.useState<Employee | null>(null);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [scheduling, setScheduling] = React.useState<Employee | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [storeFilter, setStoreFilter] = React.useState<string>(
    lockToStore && defaultStoreId ? defaultStoreId : defaultStoreId ?? "all",
  );

  // Weekly Summary's loaded weeks, kept here because the tab unmounts on leave.
  // A write drops `weeks` only; the viewed week and filter survive it.
  const summaryScope = defaultStoreId ?? null;
  const [weekSummary, setWeekSummary] = React.useState<StaffWeekCache>(() =>
    emptyStaffWeekCache(summaryScope),
  );
  if (weekSummary.scope !== summaryScope) {
    setWeekSummary((c) => ({ ...c, scope: summaryScope, weeks: {} }));
  }
  const invalidateWeekSummary = React.useCallback(
    () => setWeekSummary((c) => ({ ...c, weeks: {} })),
    [],
  );

  // ---- Lazily-loaded tab slice ----
  // The page ships Daily Approval's data only. The directory arrives when its
  // tab is first opened, and is dropped again whenever something that could
  // change it succeeds. `null` means "not loaded", which is NOT the same as empty.
  const [directory, setDirectory] = React.useState<Employee[] | null>(null);
  const [directoryError, setDirectoryError] = React.useState<string | null>(null);
  const [directoryNonce, setDirectoryNonce] = React.useState(0);
  const directoryRequested = React.useRef(false);

  React.useEffect(() => {
    if (tab !== "people" || directoryRequested.current) return;
    directoryRequested.current = true;
    let cancelled = false;
    setDirectoryError(null);
    loadEmployeeDirectory()
      .then((rows) => {
        if (!cancelled) setDirectory(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        directoryRequested.current = false;
        setDirectoryError(err instanceof Error ? err.message : "Failed to load employees");
      });
    return () => {
      cancelled = true;
    };
  }, [tab, directoryNonce]);

  /**
   * Drop the lazy directory. A profile edit rewrites the cards, and
   * `revalidatePath` does not reach state held in the browser — so every
   * mutation has to say so here.
   */
  const invalidateSlices = React.useCallback(() => {
    directoryRequested.current = false;
    setDirectory(null);
    setDirectoryNonce((n) => n + 1);
    invalidateWeekSummary();
  }, [invalidateWeekSummary]);

  // Per-day clocked hours, kept in state so approve/undo updates instantly.
  const [daily, setDaily] =
    React.useState<ClockDailySummary[]>(clockDailySummaries);
  React.useEffect(() => {
    setDaily(clockDailySummaries);
  }, [clockDailySummaries]);

  // Approved cover-driver days — kept in state so approve/delete updates
  // instantly without waiting on the router cache, same as employee hours.
  const [coverHours, setCoverHours] =
    React.useState<CoverDriverHoursComputed[]>(coverDriverHours);
  React.useEffect(() => {
    setCoverHours(coverDriverHours);
  }, [coverDriverHours]);

  const employees = initialEmployees;

  const filtered = (directory ?? []).filter((e) => {
    if (!showArchived && (e.employment_status === "left" || !e.is_active))
      return false;
    if (storeFilter !== "all" && e.store_id !== storeFilter) return false;
    return true;
  });

  const activeCount = (directory ?? employees).filter(
    (e) => e.employment_status === "active",
  ).length;

  // ---- Daily approval handlers (server action + optimistic local patch) ----
  const patchDaily = (
    match: (d: ClockDailySummary) => boolean,
    next: Partial<ClockDailySummary>,
  ) => setDaily((prev) => prev.map((d) => (match(d) ? { ...d, ...next } : d)));

  async function handleApproveDay(
    employee_id: string,
    event_date: string,
    override_hours?: number,
    deliveries?: {
      short?: number;
      long?: number;
      extraShort?: number;
      extraShortReason?: string;
      extraLong?: number;
      extraLongReason?: string;
    },
  ) {
    await approveDailyHours({
      employee_id,
      event_date,
      override_hours,
      short_deliveries: deliveries?.short,
      long_deliveries: deliveries?.long,
      extra_short_deliveries: deliveries?.extraShort,
      extra_short_reason: deliveries?.extraShortReason,
      extra_long_deliveries: deliveries?.extraLong,
      extra_long_reason: deliveries?.extraLongReason,
    });
    patchDaily(
      (d) => d.employee_id === employee_id && d.event_date === event_date,
      {
        hours_approved: true,
        approved_hours:
          override_hours != null
            ? Number(override_hours)
            : daily.find(
                (d) =>
                  d.employee_id === employee_id && d.event_date === event_date,
              )?.clocked_hours ?? null,
        // Optimistically reflect a delivery correction so the approved row
        // shows the confirmed figure before router.refresh() lands.
        ...(deliveries?.short != null ? { short_deliveries: deliveries.short } : {}),
        ...(deliveries?.long != null ? { long_deliveries: deliveries.long } : {}),
        ...(deliveries?.extraShort != null
          ? {
              extra_short_deliveries: deliveries.extraShort,
              extra_short_reason: deliveries.extraShortReason ?? null,
            }
          : {}),
        ...(deliveries?.extraLong != null
          ? {
              extra_long_deliveries: deliveries.extraLong,
              extra_long_reason: deliveries.extraLongReason ?? null,
            }
          : {}),
      },
    );
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleApproveDate(event_date: string, employee_ids: string[]) {
    await approveDailyHoursForDate({ event_date, employee_ids });
    const ids = new Set(employee_ids);
    setDaily((prev) =>
      prev.map((d) =>
        d.event_date === event_date && ids.has(d.employee_id) && !d.hours_approved
          ? { ...d, hours_approved: true, approved_hours: d.clocked_hours }
          : d,
      ),
    );
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleUnapproveDay(employee_id: string, event_date: string) {
    await unapproveDailyHours({ employee_id, event_date });
    patchDaily(
      (d) => d.employee_id === employee_id && d.event_date === event_date,
      { hours_approved: false, approved_hours: null },
    );
    invalidateWeekSummary();
    router.refresh();
  }

  function handleCoverHoursApproved(fresh: CoverDriverHoursComputed[]) {
    setCoverHours(fresh);
    invalidateWeekSummary();
    router.refresh();
  }

  function handleCoverHoursDeleted(deletedId: string) {
    setCoverHours((prev) => prev.filter((r) => r.id !== deletedId));
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleCoverApproveDay(
    cover_driver_id: string,
    work_date: string,
    override_hours?: number,
    deliveries?: DeliveryEdit,
  ) {
    const res = await approveCoverDriverDay({
      cover_driver_id,
      work_date,
      override_hours,
      deliveries: deliveries ? toDeliveryInput(deliveries) : undefined,
    });
    setCoverHours(res.hours);
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleShiftApproval(session_id: string, approved: boolean) {
    await setShiftApproval({ session_id, approved });
    // The day's own row is re-derived server-side from its shifts, so unlike the
    // day-level handlers there is nothing sensible to patch locally — refresh
    // and take the recomputed header.
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleManagerApprove(
    manager_id: string,
    event_date: string,
    deliveries?: DeliveryEdit,
  ) {
    const res = await approveManagerDeliveries({
      manager_id,
      event_date,
      deliveries: deliveries ? toDeliveryInput(deliveries) : undefined,
    });
    if (!res.ok) throw new Error(res.error);
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleManagerUnapprove(manager_id: string, event_date: string) {
    const res = await unapproveManagerDeliveries({ manager_id, event_date });
    if (!res.ok) throw new Error(res.error);
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleCoverApproveDate(
    work_date: string,
    cover_driver_ids: string[],
  ) {
    const res = await approveCoverDriverDaysForDate({ work_date, cover_driver_ids });
    setCoverHours(res.hours);
    invalidateWeekSummary();
    router.refresh();
  }

  async function handleCoverUnapprove(approved_row_id: string) {
    await deleteCoverDriverHours(approved_row_id);
    setCoverHours((prev) => prev.filter((r) => r.id !== approved_row_id));
    invalidateWeekSummary();
    router.refresh();
  }

  // Admin can view all stores; scope the cover-driver data to the active filter.
  const inStore = (storeId: string) => storeFilter === "all" || storeId === storeFilter;
  const visibleCoverDrivers = coverDrivers.filter((d) => inStore(d.store_id));
  const visibleCoverDays = coverDriverDays.filter((d) => inStore(d.store_id));
  const visibleCoverHours = coverHours.filter((h) => inStore(h.store_id));

  // A profile edit, a manual clock entry or a cover-driver change can move the
  // directory, so it is dropped alongside the server revalidation.
  const refresh = () => {
    invalidateSlices();
    router.refresh();
  };

  // Daily view: scope to the selected store and count what still needs approval.
  const visibleDaily = daily.filter(
    (d) => storeFilter === "all" || d.store_id === storeFilter,
  );
  // A pre-034 manager day has a null store_id; keep it visible rather than
  // silently dropping a day someone still has to sign off.
  const visibleManagerDaily = managerDaily.filter(
    (m) => storeFilter === "all" || !m.store_id || m.store_id === storeFilter,
  );
  const coverDaily = React.useMemo(
    () => mergeCoverDailyApproval(visibleCoverDays, visibleCoverHours),
    [visibleCoverDays, visibleCoverHours],
  );
  const dailyPending =
    visibleDaily.filter((d) => !d.hours_approved && d.clocked_hours > 0).length +
    coverDaily.filter((d) => !d.approved && d.clocked_hours > 0).length +
    // Manager rows are drop sign-offs, and only exist where drops were logged —
    // the tab badge must match what the screen actually lists, or the count
    // reads as stale the moment a manager covers a round.
    visibleManagerDaily.filter(
      (m) =>
        !m.approved &&
        m.short_deliveries + m.long_deliveries + m.extra_short_deliveries + m.extra_long_deliveries >
          0,
    ).length;
  const showStore =
    !lockToStore && storeFilter === "all" && stores.length > 1;

  const tabs: TabItem[] = [
    { id: "daily", label: "Daily Approval", badge: dailyPending },
    { id: "people", label: "Employees" },
    { id: "summary", label: "Weekly Summary" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: tabs + (admin) store scope */}
      {loadError && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">Couldn&apos;t load clock records</p>
          <p className="text-xs mt-1 text-danger/90">
            Hours below may be incomplete — don&apos;t approve from this screen until it&apos;s
            fixed. If a database migration is pending, run it and reload. ({loadError})
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 print:hidden">
        <Tabs
          tabs={tabs}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
          className="w-full sm:w-auto"
        />
        {!lockToStore && (
          <div className="w-full sm:w-44">
            <Select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              aria-label="Filter by store"
            >
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* ---------------- DAILY APPROVAL ---------------- */}
      {tab === "daily" && (
        <DailyHoursApproval
          summaries={visibleDaily}
          coverSummaries={coverDaily}
          stores={stores}
          todayISO={todayISO}
          showStore={showStore}
          canChooseStore={!lockToStore}
          // A manager can't pick the store, so the entry is fixed to the one
          // they're running — otherwise a visiting employee would default to
          // their home store, which the server refuses to write for a manager.
          entryStoreId={lockToStore ? defaultStoreId ?? null : null}
          entryStores={entryStores}
          entryEmployeeDays={entryEmployeeDays}
          entryEmployees={entryEmployees.map((e) => ({
            id: e.id,
            name: e.name,
            is_driver: hasRole(e.position, "Driver"),
            store_id: e.store_id,
          }))}
          employees={employees
            .filter(
              (e) =>
                e.employment_status === "active" &&
                // An admin picking the store must be able to reach someone based
                // elsewhere — recording a Stevenage employee's day at Hitchin is
                // the entire point, and the store filter would hide them. A
                // manager stays scoped exactly as before.
                (lockToStore ? storeFilter === "all" || e.store_id === storeFilter : true),
            )
            // is_driver decides whether the missed-entry card offers the
            // delivery boxes — a kitchen shift has no drops to record.
            .map((e) => ({
              id: e.id,
              name: e.name,
              is_driver: hasRole(e.position, "Driver"),
              store_id: e.store_id,
            }))}
          coverDrivers={visibleCoverDrivers
            .filter((d) => d.is_active)
            .map((d) => ({ id: d.id, name: d.name }))}
          onManualSaved={refresh}
          onApprove={handleApproveDay}
          onApproveDate={handleApproveDate}
          onUnapprove={handleUnapproveDay}
          onCoverApprove={handleCoverApproveDay}
          onCoverApproveDate={handleCoverApproveDate}
          onCoverUnapprove={handleCoverUnapprove}
          managerSummaries={visibleManagerDaily}
          managers={managers}
          onManagerApprove={handleManagerApprove}
          onManagerUnapprove={handleManagerUnapprove}
          onShiftApproval={handleShiftApproval}
        />
      )}

      {/* ---------------- EMPLOYEES (cards) ---------------- */}
      {tab === "people" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-text-muted">
                {activeCount} active employee{activeCount === 1 ? "" : "s"}
              </p>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs text-gold hover:underline"
              >
                {showArchived ? "Hide archived/left" : "Show archived/left"}
              </button>
              <a href="#cover-drivers" className="sm:hidden text-xs text-gold hover:underline">
                Cover drivers ↓
              </a>
            </div>
            <Button
              onClick={() => setShowAdd(true)}
              iconLeft={<PlusIcon size={16} />}
              className="w-full sm:w-auto"
            >
              Add Employee
            </Button>
          </div>

          {directoryError ? (
            <Card className="border-danger/40">
              <p className="text-sm text-danger">
                Couldn&apos;t load employee profiles — {directoryError}. This is not an
                empty roster; reload before adding anyone.
              </p>
            </Card>
          ) : directory === null ? (
            <Card>
              <p className="text-sm text-text-muted">Loading employees…</p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<UsersIcon />}
                title="No employees"
                description="Add your first employee to start scheduling shifts and tracking hours."
                action={
                  <Button
                    onClick={() => setShowAdd(true)}
                    iconLeft={<PlusIcon size={16} />}
                  >
                    Add Employee
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-sm:gap-2">
              {filtered.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  stores={stores}
                  onView={() => setViewing(emp)}
                  onEdit={() => setEditing(emp)}
                  onSchedule={() => setScheduling(emp)}
                  onChanged={refresh}
                  minWageBands={minWageBands}
                />
              ))}
            </div>
          )}

          <div id="cover-drivers" className="scroll-mt-20">
          <CoverDriversCard
            drivers={visibleCoverDrivers}
            days={visibleCoverDays}
            stores={stores}
            defaultStoreId={
              storeFilter !== "all" ? storeFilter : defaultStoreId
            }
            lockToStore={lockToStore}
            showStoreColumn={!lockToStore && storeFilter === "all"}
            todayISO={todayISO}
            onChanged={refresh}
          />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cover Drivers &mdash; Hours &amp; Approvals</CardTitle>
              <CardDescription>
                Approve each cover shift a driver clocked. Approved cash pay is hours ×
                rate plus delivery pay.
              </CardDescription>
            </CardHeader>
            <CoverDriverHoursTable
              drivers={visibleCoverDrivers}
              days={visibleCoverDays}
              approvedRows={visibleCoverHours}
              todayISO={todayISO}
              onApproved={handleCoverHoursApproved}
              onDeleted={handleCoverHoursDeleted}
              onManualSaved={refresh}
            />
          </Card>
        </div>
      )}

      {/* ---------------- WEEKLY SUMMARY (read-only) ---------------- */}
      {/* Loaded weeks live in `weekSummary`; approvals and edits above empty it. */}
      {tab === "summary" && (
        <StaffWeekSummary
          storeFilter={storeFilter}
          todayISO={todayISO}
          cache={weekSummary}
          onCacheChange={setWeekSummary}
        />
      )}

      {/* ---------------- Modals (any tab) ---------------- */}
      {viewing && (
        <EmployeeDetailModal
          employee={viewing}
          stores={stores}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null);
            setEditing(viewing);
          }}
          onSchedule={() => {
            setViewing(null);
            setScheduling(viewing);
          }}
          minWageBands={minWageBands}
        />
      )}
      {showAdd && (
        <AddEmployeeModal
          stores={stores}
          defaultStoreId={defaultStoreId}
          lockStore={lockToStore}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}
      {editing && (
        <EditEmployeeModal
          employee={editing}
          stores={stores}
          canEditContactEmail={canEditContactEmail}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {scheduling && (
        <ScheduleEditModal
          employee={scheduling}
          onClose={() => setScheduling(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
