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
import type { Employee, EmployeeHoursComputed } from "@/lib/types";

type Props = {
  initialEmployees: Employee[];
  initialHours: EmployeeHoursComputed[];
};

export function EmployeesView({ initialEmployees, initialHours }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  const employees = initialEmployees;
  const hours = initialHours;

  const visible = showArchived ? employees : employees.filter((e) => e.is_active);
  const activeCount = employees.filter((e) => e.is_active).length;

  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm text-text-muted">
            {activeCount} active employee{activeCount === 1 ? "" : "s"}
          </p>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-gold hover:underline"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
        <Button onClick={() => setShowAdd(true)} iconLeft={<PlusIcon size={16} />}>
          Add Employee
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersIcon />}
            title="No employees yet"
            description="Add your first employee to start tracking weekly hours and cash payments."
            action={
              <Button onClick={() => setShowAdd(true)} iconLeft={<PlusIcon size={16} />}>
                Add Employee
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
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
            Enter hours for the week. Anything over 20 is paid in cash and counts as an
            expense in analytics.
          </CardDescription>
        </CardHeader>
        <LogHoursForm
          employees={employees.filter((e) => e.is_active)}
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
