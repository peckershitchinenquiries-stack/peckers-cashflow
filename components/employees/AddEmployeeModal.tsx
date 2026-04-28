"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createEmployee } from "@/app/actions/employees";
import { todayISO } from "@/lib/utils";

export function AddEmployeeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [joined, setJoined] = React.useState(todayISO());
  const [notes, setNotes] = React.useState("");
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
      await createEmployee({
        name,
        phone: phone || null,
        hourly_rate: Number(rate),
        joined_date: joined || null,
        notes: notes || null,
      });
      toast.success("Employee added");
      onCreated();
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
      title="Add Employee"
      description="Hourly rate is used to calculate cash pay for hours over 20/week."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} type="submit" form="add-employee-form">
            Save Employee
          </Button>
        </>
      }
    >
      <form id="add-employee-form" onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
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
