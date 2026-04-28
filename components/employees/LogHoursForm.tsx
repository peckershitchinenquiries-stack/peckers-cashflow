"use client";

import * as React from "react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { logEmployeeHours } from "@/app/actions/employees";
import type { Employee } from "@/lib/types";
import { formatINR, startOfISOWeek, todayISO, toISODate } from "@/lib/utils";

const BANK_LIMIT = 20;

export function LogHoursForm({
  employees,
  onLogged,
}: {
  employees: Employee[];
  onLogged: () => void;
}) {
  const toast = useToast();
  const [empId, setEmpId] = React.useState<string>(employees[0]?.id ?? "");
  const [weekStart, setWeekStart] = React.useState(toISODate(startOfISOWeek(new Date())));
  const [hours, setHours] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<{ [k: string]: string }>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!empId && employees.length > 0) setEmpId(employees[0].id);
  }, [employees, empId]);

  // If user picks a date that isn't a Monday, snap to that ISO week's Monday.
  function onDateChange(value: string) {
    if (!value) {
      setWeekStart("");
      return;
    }
    const d = new Date(value + "T00:00:00");
    const monday = startOfISOWeek(d);
    setWeekStart(toISODate(monday));
  }

  const employee = employees.find((e) => e.id === empId);
  const totalHours = Number(hours) || 0;
  const bankHours = Math.min(totalHours, BANK_LIMIT);
  const cashHours = Math.max(totalHours - BANK_LIMIT, 0);
  const cashAmount = employee ? cashHours * Number(employee.hourly_rate) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!empId) errs.emp = "Pick an employee";
    if (!weekStart) errs.week = "Select a week";
    if (totalHours < 0 || isNaN(totalHours)) errs.hours = "Enter total hours";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      await logEmployeeHours({
        employee_id: empId,
        week_start_date: weekStart,
        total_hours_worked: totalHours,
        notes: notes || null,
      });
      toast.success("Hours logged");
      setHours("");
      setNotes("");
      onLogged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (employees.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Add at least one active employee before logging hours.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select
        label="Employee"
        value={empId}
        onChange={(e) => setEmpId(e.target.value)}
        error={errors.emp}
      >
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {formatINR(e.hourly_rate)}/hr
          </option>
        ))}
      </Select>

      <Input
        type="date"
        label="Week Start (Mon)"
        value={weekStart}
        onChange={(e) => onDateChange(e.target.value)}
        hint="Auto-snaps to Monday of the chosen week."
        error={errors.week}
      />

      <Input
        type="number"
        inputMode="decimal"
        step="0.25"
        min="0"
        label="Total Hours This Week"
        placeholder="e.g. 28.5"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        error={errors.hours}
      />

      <Input
        label="Notes"
        placeholder="(optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={140}
      />

      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-bg border border-border px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Bank hours</span>
          <span className="text-sm font-semibold">{bankHours.toFixed(2)} hrs</span>
        </div>
        <div className="rounded-xl bg-bg border border-border px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Cash hours</span>
          <span className="text-sm font-semibold">{cashHours.toFixed(2)} hrs</span>
        </div>
        <div className="rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gold/80">Cash due</span>
          <span className="text-sm font-semibold text-gold">{formatINR(cashAmount)}</span>
        </div>
      </div>

      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" loading={busy}>
          Save Hours
        </Button>
      </div>
    </form>
  );
}
