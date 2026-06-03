"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { EmployeeCard } from "./EmployeeCard";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EditEmployeeModal } from "./EditEmployeeModal";
import { ScheduleEditModal } from "./ScheduleEditModal";
import { LogHoursForm } from "./LogHoursForm";
import { HoursTable } from "./HoursTable";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsersIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Input";
import type { ClockWeeklySummary, Employee, EmployeeHoursComputed, Store } from "@/lib/types";
import type { MinWageBands } from "@/lib/settings";

type Props = {
  initialEmployees: Employee[];
  initialHours: EmployeeHoursComputed[];
  clockSummaries?: ClockWeeklySummary[];
  stores: Store[];
  defaultStoreId?: string | null;
  minWageBands?: MinWageBands;
  /** Manager portal: lock everything to a single store, hide cross-store UI. */
  lockToStore?: boolean;
};

export function EmployeesView({
  initialEmployees,
  initialHours,
  clockSummaries = [],
  stores,
  defaultStoreId,
  minWageBands,
  lockToStore = false,
}: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [scheduling, setScheduling] = React.useState<Employee | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [storeFilter, setStoreFilter] = React.useState<string>(
    lockToStore && defaultStoreId ? defaultStoreId : defaultStoreId ?? "all",
  );

  // Store hours in state so we can update it instantly on save/delete without
  // relying on router.refresh() (which is async and can hit the router cache).
  const [hours, setHours] = React.useState<EmployeeHoursComputed[]>(initialHours);

  // Keep in sync when the server component provides fresh props (e.g. after
  // navigating away and back, or an unrelated router.refresh()).
  React.useEffect(() => {
    setHours(initialHours);
  }, [initialHours]);

  const employees = initialEmployees;

  const filtered = employees.filter((e) => {
    if (!showArchived && (e.employment_status === "left" || !e.is_active))
      return false;
    if (storeFilter !== "all" && e.store_id !== storeFilter) return false;
    return true;
  });

  const activeCount = employees.filter(
    (e) => e.employment_status === "active",
  ).length;

  // Called after a manual hours save — the action returns fresh rows so we can
  // update state immediately instead of waiting for the router cache.
  function handleLogged(freshHours: EmployeeHoursComputed[]) {
    setHours(freshHours);
    router.refresh(); // sync everything else (employee cards, analytics)
  }

  // Called after a delete — optimistically remove the row then re-sync.
  function handleDeleted(deletedId: string) {
    setHours((prev) => prev.filter((r) => r.id !== deletedId));
    router.refresh();
  }

  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
          {!lockToStore && (
            <div className="w-44">
              <Select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
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
        <Button onClick={() => setShowAdd(true)} iconLeft={<PlusIcon size={16} />}>
          Add Employee
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersIcon />}
            title="No employees"
            description="Add your first employee to start scheduling shifts and tracking hours."
            action={
              <Button onClick={() => setShowAdd(true)} iconLeft={<PlusIcon size={16} />}>
                Add Employee
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              stores={stores}
              onEdit={() => setEditing(emp)}
              onSchedule={() => setScheduling(emp)}
              onChanged={refresh}
              minWageBands={minWageBands}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Log Weekly Hours</CardTitle>
          <CardDescription>
            Quick log for a single employee/week. The rota tab handles per-day
            scheduling.
          </CardDescription>
        </CardHeader>
        <LogHoursForm
          employees={employees.filter((e) => e.employment_status === "active")}
          onLogged={handleLogged}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hours History</CardTitle>
          <CardDescription>
            Manual logs and auto-calculated hours from clock-in/out events.
          </CardDescription>
        </CardHeader>
        <HoursTable
          employees={employees}
          rows={hours}
          clockSummaries={clockSummaries}
          onDeleted={handleDeleted}
        />
      </Card>

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
