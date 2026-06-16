"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { archiveEmployee } from "@/app/actions/employees";
import {
  ArchiveIcon,
  CalendarIcon,
  PencilIcon,
  PhoneIcon,
  ClockIcon,
} from "@/components/ui/icons";
import type { Employee, Store } from "@/lib/types";
import { formatGBP } from "@/lib/utils";
import { wageComplianceForEmployee } from "@/lib/compliance";
import { DEFAULT_SETTINGS, type MinWageBands } from "@/lib/settings";

export function EmployeeCard({
  employee,
  stores,
  onEdit,
  onSchedule,
  onChanged,
  minWageBands,
}: {
  employee: Employee;
  stores: Store[];
  onEdit: () => void;
  onSchedule: () => void;
  onChanged: () => void;
  minWageBands?: MinWageBands;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  const store = stores.find((s) => s.id === employee.store_id);
  const wage = wageComplianceForEmployee(
    employee,
    minWageBands ?? DEFAULT_SETTINGS.min_wage_bands,
  );
  const underMinWage = wage ? !wage.compliant : false;

  async function toggleArchive() {
    setBusy(true);
    try {
      await archiveEmployee(employee.id, employee.is_active);
      toast.success(
        employee.is_active ? "Employee archived" : "Employee restored",
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const niRate = Number(employee.hourly_ni_rate ?? employee.hourly_rate ?? 0);
  const cashRate = employee.hourly_cash_rate ? Number(employee.hourly_cash_rate) : null;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-wide text-text-primary truncate">
            {employee.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {employee.position && (
              <Badge variant="gold">{employee.position}</Badge>
            )}
            {store && <Badge variant="neutral">{store.name}</Badge>}
            {employee.employment_status === "active" ? (
              <Badge variant="success">Active</Badge>
            ) : employee.employment_status === "inactive" ? (
              <Badge variant="warning">Inactive</Badge>
            ) : (
              <Badge variant="danger">Left</Badge>
            )}
            {underMinWage && wage && (
              <span
                title={`Needs at least £${wage.required.toFixed(2)}/h for age ${wage.age} (${(minWageBands ?? DEFAULT_SETTINGS.min_wage_bands).effective_label})`}
              >
                <Badge variant="danger">Below min wage</Badge>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSchedule}
            aria-label="Edit weekly schedule"
            title="Weekly schedule"
            className="text-text-muted hover:text-text-primary"
          >
            <CalendarIcon size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Edit"
            title="Edit"
            className="text-text-muted hover:text-text-primary"
          >
            <PencilIcon size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleArchive}
            loading={busy}
            aria-label={employee.is_active ? "Archive" : "Restore"}
            title={employee.is_active ? "Archive" : "Restore"}
            className="text-text-muted hover:text-text-primary"
          >
            <ArchiveIcon size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
        <div>
          <div className="text-text-muted">NI rate</div>
          <div className="text-text-primary font-medium">{formatGBP(niRate)}/h</div>
        </div>
        <div>
          <div className="text-text-muted">Cash rate</div>
          <div className="text-text-primary font-medium">
            {cashRate ? `${formatGBP(cashRate)}/h` : "—"}
          </div>
        </div>
      </div>

      {employee.phone && (
        <div className="flex items-center gap-2 mt-3 text-sm text-text-muted">
          <PhoneIcon size={14} />
          <span>{employee.phone}</span>
        </div>
      )}

      {employee.notes && (
        <p className="text-sm text-text-muted mt-3 line-clamp-2">{employee.notes}</p>
      )}
    </Card>
  );
}
