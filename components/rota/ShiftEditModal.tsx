"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { upsertShift, deleteShift } from "@/app/actions/rota";
import { formatDDMMYYYY, shiftHours, todayISO } from "@/lib/utils";
import type { Employee, RotaShift } from "@/lib/types";

type Props = {
  employee: Employee;
  storeId: string;
  shiftDate: string;
  existing: RotaShift | null;
  /** Previous day's times, used to pre-fill a brand-new shift for fast entry. */
  prefill?: { start: string; end: string } | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ShiftEditModal({
  employee,
  storeId,
  shiftDate,
  existing,
  prefill = null,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  // For a brand-new shift, seed times from the previous day's shift.
  const usingPrefill = !existing && !!prefill;
  const [isDayOff, setIsDayOff] = React.useState(existing?.is_day_off ?? false);
  const [start, setStart] = React.useState(
    existing?.start_time?.slice(0, 5) ?? prefill?.start ?? "",
  );
  const [end, setEnd] = React.useState(
    existing?.end_time?.slice(0, 5) ?? prefill?.end ?? "",
  );
  const [notes, setNotes] = React.useState(existing?.manager_notes ?? "");
  const [reason, setReason] = React.useState(existing?.same_day_edit_reason ?? "");
  const [busy, setBusy] = React.useState(false);

  const isSameDay = shiftDate === todayISO();
  const showReason =
    isSameDay &&
    existing &&
    (start !== (existing.start_time?.slice(0, 5) ?? "") ||
      end !== (existing.end_time?.slice(0, 5) ?? "") ||
      isDayOff !== existing.is_day_off);

  async function save() {
    setBusy(true);
    try {
      await upsertShift({
        employee_id: employee.id,
        store_id: storeId,
        shift_date: shiftDate,
        is_day_off: isDayOff,
        start_time: isDayOff ? null : start,
        end_time: isDayOff ? null : end,
        manager_notes: notes || null,
        same_day_edit_reason: showReason ? reason : null,
      });
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return onClose();
    if (!confirm("Clear this shift?")) return;
    setBusy(true);
    try {
      await deleteShift(existing.id);
      toast.success("Shift cleared");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const calculated = !isDayOff && start && end ? shiftHours(start, end) : 0;
  const canSave = isDayOff || (!!start && !!end);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${employee.name} — ${formatDDMMYYYY(shiftDate)}`}
      description={
        isSameDay
          ? "Same-day edits require a reason."
          : "Enter shift times or mark as day off."
      }
      size="md"
      footer={
        <>
          {existing && (
            <Button variant="danger" onClick={remove} disabled={busy}>
              Clear
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isDayOff}
            onChange={(e) => setIsDayOff(e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          <span>Day Off</span>
        </label>

        {!isDayOff && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="time"
              label="Start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Input
              type="time"
              label="End"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        )}

        {usingPrefill && !isDayOff && (
          <p className="text-xs text-gold">
            Pre-filled from the previous day — adjust if needed.
          </p>
        )}

        {calculated > 0 && (
          <p className="text-xs text-text-muted">
            Scheduled hours: <span className="text-text-primary font-medium">{calculated.toFixed(2)}h</span>
          </p>
        )}

        <Textarea
          label="Manager notes (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. covering for Sandeep"
        />

        {showReason && (
          <Textarea
            label="Reason for same-day edit *"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Left early – family emergency"
          />
        )}
      </div>
    </Modal>
  );
}
