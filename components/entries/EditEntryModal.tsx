"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateCashEntry } from "@/app/actions/entries";

type Entry = {
  id: string;
  entry_date: string;
  cash_sales: number;
  supermarket_expenses: number;
  notes: string | null;
};

export function EditEntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = React.useState(entry.entry_date);
  const [sales, setSales] = React.useState(String(entry.cash_sales));
  const [exp, setExp] = React.useState(String(entry.supermarket_expenses));
  const [notes, setNotes] = React.useState(entry.notes ?? "");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateCashEntry({
        id: entry.id,
        entry_date: date,
        cash_sales: Number(sales) || 0,
        supermarket_expenses: Number(exp) || 0,
        notes: notes || null,
      });
      toast.success("Entry updated");
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
      title="Edit Entry"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} type="submit" form="edit-entry-form">
            Save
          </Button>
        </>
      }
    >
      <form id="edit-entry-form" onSubmit={submit} className="flex flex-col gap-4">
        <Input
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Cash Sales"
          prefix="£"
          value={sales}
          onChange={(e) => setSales(e.target.value)}
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Supermarket Expenses"
          prefix="£"
          value={exp}
          onChange={(e) => setExp(e.target.value)}
        />
        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="(optional)"
        />
      </form>
    </Modal>
  );
}
