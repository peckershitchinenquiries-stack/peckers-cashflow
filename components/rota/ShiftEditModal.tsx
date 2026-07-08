"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { upsertShift, deleteShift } from "@/app/actions/rota";
import { formatDDMMYYYY, shiftHours, todayISO } from "@/lib/utils";
import { presetTimes, type ShiftTimeSettings } from "@/lib/settings";
import { hasRole, type Employee, type RotaShift, type ShiftPreset } from "@/lib/types";

type Props = {
  employee: Employee;
  storeId: string;
  shiftDate: string;
  existing: RotaShift | null;
  /** Configured open/close/evening times used to resolve the presets. */
  shiftTimes: ShiftTimeSettings;
  /** Previous day's times, used to pre-fill a brand-new custom shift. */
  prefill?: { start: string; end: string } | null;
  onClose: () => void;
  onSaved: () => void;
};

type Mode = ShiftPreset | "day_off" | "custom";

const MODES: { key: Mode; label: string }[] = [
  { key: "open_close", label: "Open → Close" },
  { key: "evening_close", label: "Evening → Close" },
  { key: "custom", label: "Custom times" },
  { key: "day_off", label: "Day Off" },
];

/** Pick the initial mode for the modal from the existing shift (if any). */
function initialMode(existing: RotaShift | null): Mode {
  if (existing?.is_day_off) return "day_off";
  if (existing?.shift_type === "open_close" || existing?.shift_type === "evening_close") {
    return existing.shift_type;
  }
  if (existing?.start_time) return "custom";
  return "open_close"; // most common — one click to save
}

export function ShiftEditModal({
  employee,
  storeId,
  shiftDate,
  existing,
  shiftTimes,
  prefill = null,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const isDriver = hasRole(employee.position, "Driver");

  const [mode, setMode] = React.useState<Mode>(() => initialMode(existing));
  // Custom-mode manual times (seed from the existing shift, else previous day).
  const [start, setStart] = React.useState(
    existing?.start_time?.slice(0, 5) ?? prefill?.start ?? "",
  );
  const [end, setEnd] = React.useState(
    existing?.end_time?.slice(0, 5) ?? prefill?.end ?? "",
  );
  const [notes, setNotes] = React.useState(existing?.manager_notes ?? "");
  const [reason, setReason] = React.useState(existing?.same_day_edit_reason ?? "");
  const [busy, setBusy] = React.useState(false);

  const isDayOff = mode === "day_off";
  const isPreset = mode === "open_close" || mode === "evening_close";

  // Effective start/end for the chosen mode (presets resolve from settings).
  const eff = React.useMemo<{ start: string; end: string }>(() => {
    if (isDayOff) return { start: "", end: "" };
    if (isPreset) return presetTimes(mode, isDriver, shiftTimes);
    return { start, end };
  }, [mode, isDayOff, isPreset, isDriver, shiftTimes, start, end]);

  const isSameDay = shiftDate === todayISO();
  const showReason =
    isSameDay &&
    !!existing &&
    (eff.start !== (existing.start_time?.slice(0, 5) ?? "") ||
      eff.end !== (existing.end_time?.slice(0, 5) ?? "") ||
      isDayOff !== existing.is_day_off);

  const calculated = !isDayOff && eff.start && eff.end ? shiftHours(eff.start, eff.end) : 0;
  const canSave = isDayOff || isPreset || (!!start && !!end);

  async function save() {
    setBusy(true);
    try {
      await upsertShift({
        employee_id: employee.id,
        store_id: storeId,
        shift_date: shiftDate,
        is_day_off: isDayOff,
        shift_type: isPreset ? (mode as ShiftPreset) : null,
        start_time: isDayOff ? null : eff.start,
        end_time: isDayOff ? null : eff.end,
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

  return (
    <Modal
      open
      onClose={onClose}
      title={`${employee.name} — ${formatDDMMYYYY(shiftDate)}`}
      description={
        isSameDay
          ? "Same-day edits require a reason."
          : "Pick a shift preset, or enter custom times."
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
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={
                  "h-11 rounded-xl border text-sm font-medium transition-colors " +
                  (active
                    ? m.key === "day_off"
                      ? "bg-danger/15 border-danger/50 text-danger"
                      : "bg-gold text-black border-gold"
                    : "bg-surface border-border text-text-primary hover:bg-surface-hover")
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Preset preview */}
        {isPreset && (
          <div className="rounded-xl border border-border bg-surface-hover/40 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-subtle">
                {mode === "open_close" ? "Open → Close" : "Evening → Close"}
                <span className="text-text-muted"> · {isDriver ? "Driver" : "Kitchen"}</span>
              </span>
              <span className="font-medium text-text-primary tabular-nums">
                {eff.start}–{eff.end}
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              Times come from this store's shift times (Settings → Stores). Change them there to update every preset shift.
            </p>
          </div>
        )}

        {/* Custom times */}
        {mode === "custom" && (
          <>
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
            {!existing && prefill && (
              <p className="text-xs text-gold">
                Pre-filled from the previous day — adjust if needed.
              </p>
            )}
          </>
        )}

        {calculated > 0 && (
          <p className="text-xs text-text-muted">
            Scheduled hours:{" "}
            <span className="text-text-primary font-medium">{calculated.toFixed(2)}h</span>
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
