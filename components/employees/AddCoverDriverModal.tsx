"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { addCoverDriverRecord } from "@/app/actions/cover-drivers";
import { formatGBP, toISODate } from "@/lib/utils";
import type { CoverDriverRecord, Store } from "@/lib/types";

export function AddCoverDriverModal({
  stores,
  defaultStoreId,
  lockStore,
  onClose,
  onCreated,
}: {
  stores: Store[];
  defaultStoreId?: string | null;
  /** Manager portal: store is fixed to the manager's store. */
  lockStore?: boolean;
  onClose: () => void;
  onCreated: (record: CoverDriverRecord) => void;
}) {
  const toast = useToast();
  const [storeId, setStoreId] = React.useState<string>(
    defaultStoreId ?? stores[0]?.id ?? "",
  );
  const [name, setName] = React.useState("");
  const [workDate, setWorkDate] = React.useState(toISODate(new Date()));
  const [hours, setHours] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [errors, setErrors] = React.useState<{ [k: string]: string }>({});
  const [busy, setBusy] = React.useState(false);

  const hoursNum = parseFloat(hours) || 0;
  const rateNum = parseFloat(rate) || 0;
  const totalPay = hoursNum * rateNum;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!storeId) errs.store = "Pick a store";
    if (!name.trim()) errs.name = "Enter the driver's name";
    if (!workDate) errs.date = "Select the work date";
    if (!hours.trim() || hoursNum <= 0) errs.hours = "Enter a positive number of hours";
    if (!rate.trim() || rateNum <= 0) errs.rate = "Enter a positive hourly rate";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      const res = await addCoverDriverRecord({
        store_id: storeId,
        driver_name: name.trim(),
        work_date: workDate,
        hours_worked: hoursNum,
        hourly_rate: rateNum,
      });
      toast.success(`Cover driver recorded — ${name.trim()}`);
      onCreated(res.record);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add record");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Cover Driver"
      description="Record a one-off payment to a part-time cover driver (not a permanent employee)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="cover-driver-form" loading={busy}>
            Save Record
          </Button>
        </>
      }
    >
      <form id="cover-driver-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!lockStore && (
          <Select
            label="Store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            error={errors.store}
            className="sm:col-span-2"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}

        <Input
          label="Driver Name"
          placeholder="e.g. John Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          maxLength={120}
        />

        <DatePicker
          label="Work Date"
          value={workDate}
          onChange={setWorkDate}
          error={errors.date}
        />

        <Input
          type="number"
          inputMode="decimal"
          step="0.25"
          min="0.25"
          label="Hours Worked"
          placeholder="e.g. 6"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          error={errors.hours}
        />

        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Hourly Rate"
          prefix="£"
          placeholder="e.g. 12.50"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          error={errors.rate}
        />

        <div className="sm:col-span-2 rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gold/80">Total pay</span>
          <span className="text-sm font-semibold text-gold">
            {totalPay > 0 ? formatGBP(totalPay) : "—"}
          </span>
        </div>
      </form>
    </Modal>
  );
}
