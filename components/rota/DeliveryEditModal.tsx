"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { upsertWeeklyDelivery } from "@/app/actions/rota";
import type { Employee, WeeklyDelivery } from "@/lib/types";

type Props = {
  driver: Employee;
  storeId: string;
  weekStartIso: string;
  existing: WeeklyDelivery | null;
  onClose: () => void;
  onSaved: () => void;
};

export function DeliveryEditModal({
  driver,
  storeId,
  weekStartIso,
  existing,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const [avg, setAvg] = React.useState(
    existing?.manager_avg_4wk?.toString() ?? "",
  );
  const [vita, setVita] = React.useState(
    existing?.vita_mojo_count?.toString() ?? "",
  );
  const [notes, setNotes] = React.useState(existing?.notes ?? "");
  const [reason, setReason] = React.useState(existing?.reason ?? "");
  const [busy, setBusy] = React.useState(false);

  const needsReason =
    Number(avg) > 0 &&
    Number(vita) > 0 &&
    Number(avg) > Number(vita);

  async function save() {
    if (needsReason && !reason.trim()) {
      toast.error("Reason required when live count exceeds Vita Mojo.");
      return;
    }
    setBusy(true);
    try {
      await upsertWeeklyDelivery({
        driver_id: driver.id,
        store_id: storeId,
        week_start_date: weekStartIso,
        manager_avg_4wk: avg ? Number(avg) : null,
        vita_mojo_count: vita ? Number(vita) : null,
        notes: notes || null,
        reason: reason || null,
      });
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
      title={`${driver.name} — Deliveries`}
      description="Manager-entered 4-week average, cross-checked against Vita Mojo each morning."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          type="number"
          label="4-Week Average (manager entry)"
          value={avg}
          onChange={(e) => setAvg(e.target.value)}
          placeholder="0"
          min="0"
        />
        <Input
          type="number"
          label="Vita Mojo count (cross-check)"
          value={vita}
          onChange={(e) => setVita(e.target.value)}
          placeholder="0"
          min="0"
        />
        {needsReason && (
          <Textarea
            label="Reason for variance *"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. extra drop-offs not on Vita Mojo"
          />
        )}
        <Textarea
          label="Notes (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
