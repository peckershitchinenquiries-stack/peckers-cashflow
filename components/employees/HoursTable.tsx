"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, ClockIcon } from "@/components/ui/icons";
import { deleteEmployeeHours } from "@/app/actions/employees";
import type { Employee, EmployeeHoursComputed } from "@/lib/types";
import { formatDDMMYYYY, formatINR } from "@/lib/utils";

export function HoursTable({
  employees,
  rows,
  onChanged,
}: {
  employees: Employee[];
  rows: EmployeeHoursComputed[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [filterEmp, setFilterEmp] = React.useState<string>("");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const filtered = rows.filter((r) => {
    if (filterEmp && r.employee_id !== filterEmp) return false;
    if (from && r.week_start_date < from) return false;
    if (to && r.week_start_date > to) return false;
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm("Delete this hours entry?")) return;
    setDeletingId(id);
    try {
      await deleteEmployeeHours(id);
      toast.success("Entry deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Employee"
          value={filterEmp}
          onChange={(e) => setFilterEmp(e.target.value)}
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          type="date"
          label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClockIcon />}
          title="No hours logged"
          description="Logs will appear here once you submit weekly hours."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Week of</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium text-right">Bank</th>
                <th className="px-3 py-2 font-medium text-right">Cash hrs</th>
                <th className="px-3 py-2 font-medium text-right">Cash £</th>
                <th className="px-3 py-2 font-medium text-right">Logged</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${i % 2 === 0 ? "" : "bg-bg/50"} border-t border-border/60`}
                >
                  <td className="px-3 py-3 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatDDMMYYYY(r.week_start_date)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {Number(r.total_hours_worked).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {Number(r.bank_hours).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {Number(r.cash_hours).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {Number(r.cash_amount_due) > 0 ? (
                      <Badge variant="gold">{formatINR(r.cash_amount_due)}</Badge>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-text-muted whitespace-nowrap">
                    {formatDDMMYYYY(r.created_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r.id)}
                      loading={deletingId === r.id}
                      aria-label="Delete"
                      className="text-text-muted hover:text-danger"
                    >
                      <TrashIcon size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
