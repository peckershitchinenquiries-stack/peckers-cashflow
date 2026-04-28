"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateEmployee } from "@/app/actions/employees";
import type { Employee } from "@/lib/types";

export function EditEmployeeModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = React.useState(employee.name);
  const [phone, setPhone] = React.useState(employee.phone || "");
  const [rate, setRate] = React.useState(String(employee.hourly_rate));
  const [joined, setJoined] = React.useState(employee.joined_date || "");
  const [notes, setNotes] = React.useState(employee.notes || "");
  const [errors, setErrors] = React.useState<{ [k: string]: string }>({});
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!rate || Number(rate) <= 0) errs.rate = "Hourly rate must be > 0";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      await updateEmployee({
        id: employee.id,
        name,
        phone: phone || null,
        hourly_rate: Number(rate),
        joined_date: joined || null,
        notes: notes || null,
      });
      toast.success("Employee updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Employee"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} type="submit" form="edit-employee-form">
            Save Changes
          </Button>
        </>
      }
    >
      <form id="edit-employee-form" onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Input
          label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(optional)"
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Hourly Rate *"
          prefix="₹"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          error={errors.rate}
        />
        <Input
          type="date"
          label="Joined Date"
          value={joined}
          onChange={(e) => setJoined(e.target.value)}
        />
        <Textarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="(optional)"
        />
      </form>
    </Modal>
  );
}
