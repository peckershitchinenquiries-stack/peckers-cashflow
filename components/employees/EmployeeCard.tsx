"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { archiveEmployee } from "@/app/actions/employees";
import {
  ArchiveIcon,
  PencilIcon,
  PhoneIcon,
  ClockIcon,
} from "@/components/ui/icons";
import type { Employee } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export function EmployeeCard({
  employee,
  onEdit,
  onChanged,
}: {
  employee: Employee;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

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

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-wide text-text-primary truncate">
            {employee.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="gold">
              {formatINR(employee.hourly_rate)}/hr
            </Badge>
            <Badge variant="neutral">
              <ClockIcon size={12} /> {employee.bank_weekly_hours_limit}h bank
            </Badge>
            {!employee.is_active && <Badge variant="warning">Archived</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Edit"
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
            className="text-text-muted hover:text-text-primary"
          >
            <ArchiveIcon size={16} />
          </Button>
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
