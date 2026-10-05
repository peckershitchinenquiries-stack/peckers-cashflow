"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { upsertManualManagerDeliveryEntry } from "@/app/actions/manager-clock";
import { formatDDMMYYYY } from "@/lib/utils";

// The manager half of "add missed entry". Deliberately has NO clock times: a
// manager's fixed daily wage turns on merely having clocked in, so recording
// times they never worked would overstate the wage bill on the Live board and
// mark them present on the Rota. Only the drops are paid, so only the drops are
// asked for.

export type ManagerEntryCandidate = {
  id: string;
  name: string;
  /** Drops already recorded for them that day — re-entering CORRECTS them. */
  existing_drops?: number;
  /** A signed-off day can't be rewritten from here; undo the approval first. */
  approved?: boolean;
  /** The store those existing drops sit on, so another store's round is addable. */
  existing_store_id?: string | null;
};

const REASON_PRESETS = [
  "Forgot to clock in",
  "Covered deliveries off shift",
  "Phone / app issue",
] as const;

export function ManagerDeliveryEntryModal({
  candidates,
  eventDate,
  stores,
  defaultStoreId,
  onClose,
  onSaved,
}: {
  candidates: ManagerEntryCandidate[];
  eventDate: string;
  /** Offered when the caller may choose — admins. Omitted fixes the store server-side. */
  stores?: Array<{ id: string; name: string }>;
  /** The store a manager is running; replaces the picker. */
  defaultStoreId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [managerId, setManagerId] = React.useState("");
  const [storeId, setStoreId] = React.useState(defaultStoreId ?? "");
  const [preset, setPreset] = React.useState<string>(REASON_PRESETS[0]);
  const [otherReason, setOtherReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [shortDrops, setShortDrops] = React.useState("");
  const [longDrops, setLongDrops] = React.useState("");
  const [extraShort, setExtraShort] = React.useState("");
  const [extraLong, setExtraLong] = React.useState("");
  const [extraShortReason, setExtraShortReason] = React.useState("");
  const [extraLongReason, setExtraLongReason] = React.useState("");

  const selected = candidates.find((c) => c.id === managerId) ?? null;
  const reason = preset === "Other" ? otherReason.trim() : preset;
  const showStorePicker = !!stores && stores.length > 1 && !defaultStoreId;
  const storeName = (id: string | null | undefined) =>
    (id && stores?.find((s) => s.id === id)?.name) || null;
  const effectiveStoreId = showStorePicker ? storeId : defaultStoreId ?? null;
  // A day can hold one hand-entered round PER STORE (migration 061), so an
  // approved round only blocks the store it was recorded against.
  const blockedByApproval =
    !!selected?.approved &&
    (!effectiveStoreId || !selected.existing_store_id ||
      selected.existing_store_id === effectiveStoreId);
  const correctsExisting =
    !!selected?.existing_drops &&
    (!effectiveStoreId || !selected.existing_store_id ||
      selected.existing_store_id === effectiveStoreId);

  const total =
    (Number(shortDrops) || 0) +
    (Number(longDrops) || 0) +
    (Number(extraShort) || 0) +
    (Number(extraLong) || 0);
  const extraShortNeedsReason = (Number(extraShort) || 0) > 0 && !extraShortReason.trim();
  const extraLongNeedsReason = (Number(extraLong) || 0) > 0 && !extraLongReason.trim();

  const canSave =
    !!managerId &&
    !blockedByApproval &&
    (!showStorePicker || !!storeId) &&
    total > 0 &&
    !!reason &&
    !extraShortNeedsReason &&
    !extraLongNeedsReason &&
    !busy;

  async function save() {
    setError(null);
    if (!managerId) return setError("Pick which manager this is for.");
    if (showStorePicker && !storeId) return setError("Pick the store these were covered at.");
    if (total <= 0) return setError("Enter at least one delivery.");
    if (!reason) return setError("Give a reason.");
    if (extraShortNeedsReason) {
      return setError("Give a reason for the extra short deliveries.");
    }
    if (extraLongNeedsReason) {
      return setError("Give a reason for the extra long deliveries.");
    }

    setBusy(true);
    try {
      const res = await upsertManualManagerDeliveryEntry({
        manager_id: managerId,
        event_date: eventDate,
        store_id: effectiveStoreId || undefined,
        reason,
        deliveries: {
          short_deliveries_count: Number(shortDrops) || 0,
          long_deliveries_count: Number(longDrops) || 0,
          extra_short_deliveries: Number(extraShort) || 0,
          extra_long_deliveries: Number(extraLong) || 0,
          extra_short_reason: extraShortReason.trim() || null,
          extra_long_reason: extraLongReason.trim() || null,
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        `${total} deliveries recorded for ${selected?.name ?? "them"}${
          storeName(effectiveStoreId) ? ` at ${storeName(effectiveStoreId)}` : ""
        } — approve the row to pay them`,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add manager entry"
      description={`${formatDDMMYYYY(eventDate)} — records deliveries a manager covered. No clock times: only the drops are paid.`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!canSave}>
            Save deliveries
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {candidates.length === 0 ? (
          <p className="text-sm text-text-muted">
            No manager accounts to record against.
          </p>
        ) : (
          <>
            <Select
              label="Manager *"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">Select…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.existing_drops
                    ? `${c.name} — ${c.existing_drops} already recorded`
                    : c.name}
                </option>
              ))}
            </Select>

            {/* Where the round was covered — it decides which store's Tuesday
                payout pays for it. A manager can cover one at each store on the
                same day, and each is recorded separately (migration 061). */}
            {showStorePicker && (
              <Select
                label="Store covered *"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                disabled={!managerId}
              >
                <option value="">Select…</option>
                {stores!.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </Select>
            )}

            {blockedByApproval ? (
              <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 -mt-1">
                {selected!.name}&apos;s deliveries for that day are already approved. Undo
                the approval on their row first, then record the correction there.
              </p>
            ) : correctsExisting ? (
              <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 -mt-1">
                {selected!.name} already has {selected!.existing_drops} deliveries
                recorded that day. Saving REPLACES this store&apos;s hand-entered
                counts rather than adding to them.
              </p>
            ) : (
              !!selected?.existing_drops && (
                <p className="text-xs text-text-muted bg-bg border border-border rounded-xl px-3 py-2 -mt-1">
                  {selected.name} already has {selected.existing_drops} deliveries that
                  day
                  {storeName(selected.existing_store_id)
                    ? ` at ${storeName(selected.existing_store_id)}`
                    : ""}
                  . This round is recorded separately, against{" "}
                  {storeName(effectiveStoreId) ?? "the store you pick"}.
                </p>
              )
            )}

            <div className="rounded-xl border border-border bg-bg px-3 py-3 flex flex-col gap-3">
              <p className="text-xs font-medium text-text-primary">
                Deliveries covered
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  label="Short (SD)"
                  value={shortDrops}
                  onChange={(e) => setShortDrops(e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  label="Long (LD)"
                  value={longDrops}
                  onChange={(e) => setLongDrops(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  label="Extra short (MS)"
                  value={extraShort}
                  onChange={(e) => setExtraShort(e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  label="Extra long (ML)"
                  value={extraLong}
                  onChange={(e) => setExtraLong(e.target.value)}
                />
              </div>

              {(Number(extraShort) || 0) > 0 && (
                <Input
                  label="Reason for extra short *"
                  placeholder="Why were these beyond the round?"
                  value={extraShortReason}
                  onChange={(e) => setExtraShortReason(e.target.value)}
                  maxLength={200}
                />
              )}
              {(Number(extraLong) || 0) > 0 && (
                <Input
                  label="Reason for extra long *"
                  placeholder="Why were these beyond the round?"
                  value={extraLongReason}
                  onChange={(e) => setExtraLongReason(e.target.value)}
                  maxLength={200}
                />
              )}

              <p className="text-[11px] text-text-muted">
                MS / ML are drops beyond the normal round, paid at the same per-drop
                rate. A manager&apos;s hours are never entered here — their salary
                doesn&apos;t come through this app.
              </p>
            </div>

            <Select
              label="Reason *"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {REASON_PRESETS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Other">Other…</option>
            </Select>

            {preset === "Other" && (
              <Input
                label="Reason *"
                placeholder="What happened?"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={200}
              />
            )}

            {error && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <p className="text-xs text-text-muted rounded-xl border border-border bg-bg px-3 py-2.5">
              Recorded against your account and shown as{" "}
              <span className="text-text-primary">Manual</span> on the day&apos;s row.
              The deliveries reach the Tuesday payout once that row is approved.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
