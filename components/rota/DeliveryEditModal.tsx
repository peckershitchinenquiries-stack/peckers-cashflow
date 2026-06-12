"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { upsertWeeklyDelivery } from "@/app/actions/rota";
import { setClockDeliveries } from "@/app/actions/clock";
import { formatDDMMYYYY } from "@/lib/utils";
import type { ClockEvent, Employee, WeeklyDelivery } from "@/lib/types";

type Props = {
  driver: Employee;
  storeId: string;
  weekStartIso: string;
  existing: WeeklyDelivery | null;
  /** ISO dates (Mon–Sun) of the displayed week. */
  weekDays?: string[];
  /** The driver's clock events for the displayed week. */
  events?: ClockEvent[];
  onClose: () => void;
  onSaved: () => void;
};

export function DeliveryEditModal({
  driver,
  storeId,
  weekStartIso,
  existing,
  weekDays = [],
  events = [],
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const [avg, setAvg] = React.useState(
    existing?.manager_avg_4wk?.toString() ?? "",
  );
  const [vita, setVita] = React.useState(
    existing?.vita_mojo_count?.toString() ?? "",
  );
  const [notes, setNotes] = React.useState(existing?.notes ?? "");
  const [reason, setReason] = React.useState(existing?.reason ?? "");
  const [busy, setBusy] = React.useState(false);

  // Per-day clocked deliveries (editable by manager/admin). All edits are
  // persisted together by the single Save button at the bottom of the modal.
  type DayEdit = { count: string; extra: string; reason: string };
  const initialDayEdits = React.useMemo(() => {
    const init: Record<string, DayEdit> = {};
    for (const d of weekDays) {
      const ev = events.find((e) => e.event_date === d);
      init[d] = {
        count: ev?.deliveries_count != null ? String(ev.deliveries_count) : "",
        extra: ev?.extra_deliveries ? String(ev.extra_deliveries) : "",
        reason: ev?.extra_delivery_reason ?? "",
      };
    }
    return init;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dayEdits, setDayEdits] = React.useState<Record<string, DayEdit>>(initialDayEdits);

  function setDay(date: string, patch: Partial<DayEdit>) {
    setDayEdits((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  function dayChanged(date: string): boolean {
    const a = dayEdits[date];
    const b = initialDayEdits[date];
    if (!a || !b) return false;
    return a.count !== b.count || a.extra !== b.extra || a.reason !== b.reason;
  }

  const needsReason =
    Number(avg) > 0 &&
    Number(vita) > 0 &&
    Number(avg) > Number(vita);

  async function save() {
    if (needsReason && !reason.trim()) {
      toast.error("Reason required when live count exceeds Vita Mojo.");
      return;
    }
    const changedDays = weekDays.filter(dayChanged);
    for (const d of changedDays) {
      const edit = dayEdits[d];
      if (Number(edit.extra) > 0 && !edit.reason.trim()) {
        toast.error(`Reason required for the extra deliveries on ${formatDDMMYYYY(d)}.`);
        return;
      }
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
      // Persist every edited day's clocked deliveries in the same save.
      for (const d of changedDays) {
        const edit = dayEdits[d];
        await setClockDeliveries({
          employee_id: driver.id,
          event_date: d,
          deliveries_count: Number(edit.count) || 0,
          extra_deliveries: Number(edit.extra) || 0,
          extra_delivery_reason: edit.reason.trim() || null,
        });
      }
      router.refresh();
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

        {weekDays.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-text-primary">Clocked deliveries (per day)</p>
            <p className="text-xs text-text-muted mb-3">
              Drivers normally enter these at clock-out. You can correct the count or
              log extra deliveries (with a reason) — everything is saved together by
              the Save button below.
            </p>
            <div className="flex flex-col gap-3">
              {weekDays.map((d) => {
                const edit = dayEdits[d];
                const showReason = Number(edit?.extra) > 0;
                return (
                  <div key={d} className="rounded-lg border border-border p-3">
                    <div className="flex items-end gap-2 flex-wrap">
                      <span className="text-xs text-text-muted w-20 shrink-0">
                        {formatDDMMYYYY(d)}
                        {dayChanged(d) && <span className="block text-gold">edited</span>}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        label="Deliveries"
                        value={edit?.count ?? ""}
                        onChange={(e) => setDay(d, { count: e.target.value })}
                        containerClassName="w-24"
                      />
                      <Input
                        type="number"
                        min="0"
                        label="Extra"
                        value={edit?.extra ?? ""}
                        onChange={(e) => setDay(d, { extra: e.target.value })}
                        containerClassName="w-20"
                      />
                    </div>
                    {showReason && (
                      <Input
                        label="Reason for extra *"
                        value={edit?.reason ?? ""}
                        onChange={(e) => setDay(d, { reason: e.target.value })}
                        placeholder="e.g. covered a second area"
                        maxLength={200}
                        containerClassName="mt-2"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
