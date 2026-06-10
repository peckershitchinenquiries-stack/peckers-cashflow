"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon } from "@/components/ui/icons";
import { upsertDailyCashEntry } from "@/app/actions/cash-flow";
import { formatGBP } from "@/lib/utils";
import type { DailyCashEntry } from "@/lib/types";

/**
 * Compact "quick entry" card for managers on the live dashboard — logs today's
 * cash reconciliation for their store. The full form (back-dating, history)
 * lives at /manager/cash-flow/daily.
 */
export function ManagerQuickEntry({
  storeId,
  today,
  existing,
}: {
  storeId: string;
  today: string;
  existing: DailyCashEntry | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [vita, setVita] = React.useState(existing ? String(existing.vita_mojo_sales) : "");
  const [envelope, setEnvelope] = React.useState(
    existing ? String(existing.envelope_amount) : "",
  );
  const [supermarket, setSupermarket] = React.useState(
    existing?.supermarket_expenses ? String(existing.supermarket_expenses) : "",
  );
  const [reason, setReason] = React.useState(existing?.reason ?? "");
  const [busy, setBusy] = React.useState(false);

  const difference = Math.round(((Number(vita) || 0) - (Number(envelope) || 0)) * 100) / 100;
  const hasDiff = Math.abs(difference) > 0.001;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (vita === "" || envelope === "") {
      toast.error("Vita Mojo figure and envelope amount are both required.");
      return;
    }
    if (hasDiff && !reason.trim()) {
      toast.error("A reason is required when there is a difference.");
      return;
    }
    setBusy(true);
    try {
      await upsertDailyCashEntry({
        store_id: storeId,
        entry_date: today,
        vita_mojo_sales: Number(vita) || 0,
        envelope_amount: Number(envelope) || 0,
        supermarket_expenses: Number(supermarket) || 0,
        reason: reason.trim() || null,
      });
      toast.success(existing ? "Today's entry updated" : "Today's entry saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        action={
          existing ? (
            <Badge variant="gold">
              <CheckIcon size={12} /> Today logged
            </Badge>
          ) : null
        }
      >
        <CardTitle>Quick Cash Entry</CardTitle>
        <CardDescription>Log today&apos;s cash for your store.</CardDescription>
      </CardHeader>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            label="Vita Mojo sales *"
            prefix="£"
            placeholder="0.00"
            value={vita}
            onChange={(e) => setVita(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            label="Envelope *"
            prefix="£"
            placeholder="0.00"
            value={envelope}
            onChange={(e) => setEnvelope(e.target.value)}
          />
        </div>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Supermarket expenses"
          prefix="£"
          placeholder="0.00"
          value={supermarket}
          onChange={(e) => setSupermarket(e.target.value)}
        />

        <div className="rounded-xl bg-bg border border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm text-text-muted">
            Difference {difference > 0 ? "(shortfall)" : difference < 0 ? "(surplus)" : ""}
          </span>
          <span
            className={
              !hasDiff
                ? "font-semibold text-success"
                : difference > 0
                  ? "font-semibold text-danger"
                  : "font-semibold text-warning"
            }
          >
            {formatGBP(difference)}
          </span>
        </div>

        {hasDiff && (
          <Input
            label="Reason for difference *"
            placeholder="e.g. Supermarket run – £29 used for supplies"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" loading={busy} className="flex-1">
            {existing ? "Update" : "Save"}
          </Button>
          <Link
            href="/manager/cash-flow/daily"
            className="btn-base outline-none bg-surface text-text-primary border border-border hover:bg-surface-hover h-11 px-4 text-sm"
          >
            Full form
          </Link>
        </div>
      </form>
    </Card>
  );
}
