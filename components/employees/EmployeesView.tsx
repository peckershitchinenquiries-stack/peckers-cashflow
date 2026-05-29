"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { EmployeeCard } from "./EmployeeCard";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EditEmployeeModal } from "./EditEmployeeModal";
import { LogHoursForm } from "./LogHoursForm";
import { HoursTable } from "./HoursTable";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsersIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Input";
import type { Employee, EmployeeHoursComputed, Store } from "@/lib/types";

type Props = {
  initialEmployees: Employee[];
  initialHours: EmployeeHoursComputed[];
  stores: Store[];
  defaultStoreId?: string | null;
};

export function EmployeesView({
  initialEmployees,
  initialHours,
  stores,
  defaultStoreId,
}: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [storeFilter, setStoreFilter] = React.useState<string>(
    defaultStoreId ?? "all",
  );

  const employees = initialEmployees;
  const hours = initialHours;

  const filtered = employees.filter((e) => {
    if (!showArchived && (e.employment_status === "left" || !e.is_active))
      return false;
    if (storeFilter !== "all" && e.store_id !== storeFilter) return false;
    return true;
  });

  const activeCount = employees.filter(
    (e) => e.employment_status === "active",
  ).length;

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
              onChanged={refresh}
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
          onLogged={refresh}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hours History</CardTitle>
          <CardDescription>All weekly hour logs</CardDescription>
        </CardHeader>
        <HoursTable
          employees={employees}
          rows={hours}
          onChanged={refresh}
        />
      </Card>

      {showAdd && (
        <AddEmployeeModal
          stores={stores}
          defaultStoreId={defaultStoreId}
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
    </div>
  );
}
