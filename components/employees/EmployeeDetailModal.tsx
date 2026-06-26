"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PencilIcon, CalendarIcon } from "@/components/ui/icons";
import type { Employee, Store } from "@/lib/types";
import { parsePositions } from "@/lib/types";
import { formatGBP } from "@/lib/utils";
import { DEFAULT_SETTINGS, type MinWageBands } from "@/lib/settings";
import { wageComplianceForEmployee } from "@/lib/compliance";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-muted shrink-0">{label}</span>
      <span className="text-sm text-text-primary text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
        {title}
      </p>
      <div className="rounded-xl border border-border px-3 py-1">{children}</div>
    </div>
  );
}

export function EmployeeDetailModal({
  employee,
  stores,
  onClose,
  onEdit,
  onSchedule,
  minWageBands,
}: {
  employee: Employee;
  stores: Store[];
  onClose: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  minWageBands?: MinWageBands;
}) {
  const store = stores.find((s) => s.id === employee.store_id);
  const niRate = Number(employee.hourly_ni_rate ?? employee.hourly_rate ?? 0);
  const cashRate = employee.hourly_cash_rate ? Number(employee.hourly_cash_rate) : null;
  const wage = wageComplianceForEmployee(
    employee,
    minWageBands ?? DEFAULT_SETTINGS.min_wage_bands,
  );
  const underMinWage = wage ? !wage.compliant : false;

  const hasBankDetails =
    employee.bank_account_name ||
    employee.bank_name ||
    employee.account_number ||
    employee.sort_code;

  const hasDeliveryRates =
    employee.short_delivery_rate != null || employee.long_delivery_rate != null;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={onSchedule}
            iconLeft={<CalendarIcon size={15} />}
          >
            Schedule
          </Button>
          <Button
            onClick={onEdit}
            iconLeft={<PencilIcon size={15} />}
          >
            Edit
          </Button>
        </>
      }
    >
      {/* Header */}
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-xl font-semibold text-text-primary">{employee.name}</h2>
        <div className="flex flex-wrap gap-2">
          {employee.position &&
            parsePositions(employee.position).map((pos) => (
              <Badge key={pos} variant="gold">
                {pos}
              </Badge>
            ))}
          {store && <Badge variant="neutral">{store.name}</Badge>}
          {employee.employment_status === "active" ? (
            <Badge variant="success">Active</Badge>
          ) : employee.employment_status === "inactive" ? (
            <Badge variant="warning">Inactive</Badge>
          ) : (
            <Badge variant="danger">Left</Badge>
          )}
          {underMinWage && wage && (
            <Badge variant="danger">Below min wage</Badge>
          )}
        </div>
      </div>

      {/* Contact */}
      <Section title="Contact">
        <Row label="Phone" value={employee.phone} />
        <Row label="Email" value={employee.email} />
      </Section>

      {/* Employment */}
      <Section title="Employment">
        <Row
          label="Start date"
          value={
            employee.employment_start_date
              ? new Date(employee.employment_start_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : null
          }
        />
        <Row
          label="Date of birth"
          value={
            employee.date_of_birth
              ? new Date(employee.date_of_birth).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : null
          }
        />
        <Row label="Gender" value={employee.gender} />
      </Section>

      {/* Pay Rates */}
      <Section title="Pay rates">
        <Row label="NI rate" value={`${formatGBP(niRate)}/h`} />
        <Row label="Cash rate" value={cashRate ? `${formatGBP(cashRate)}/h` : null} />
        {hasDeliveryRates && (
          <>
            <Row
              label="Short delivery"
              value={
                employee.short_delivery_rate != null
                  ? `${formatGBP(Number(employee.short_delivery_rate))}/delivery`
                  : null
              }
            />
            <Row
              label="Long delivery"
              value={
                employee.long_delivery_rate != null
                  ? `${formatGBP(Number(employee.long_delivery_rate))}/delivery`
                  : null
              }
            />
          </>
        )}
        {underMinWage && wage && (
          <Row
            label="Min wage required"
            value={
              <span className="text-danger">
                {formatGBP(wage.required)}/h (age {wage.age})
              </span>
            }
          />
        )}
      </Section>

      {/* Bank Details */}
      {hasBankDetails && (
        <Section title="Bank details">
          <Row label="Account name" value={employee.bank_account_name} />
          <Row label="Bank name" value={employee.bank_name} />
          <Row label="Account number" value={employee.account_number} />
          <Row label="Sort code" value={employee.sort_code} />
        </Section>
      )}

      {/* Notes */}
      {employee.notes && (
        <Section title="Notes">
          <p className="text-sm text-text-primary py-2 whitespace-pre-wrap">
            {employee.notes}
          </p>
        </Section>
      )}
    </Modal>
  );
}
