"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateSettings } from "@/app/actions/settings";
import type { AppSettings, CashFlowSettings } from "@/lib/settings";

export function CashFlowSettingsCard({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = React.useState<CashFlowSettings>(initial.cash_flow);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateSettings({
        cash_flow: {
          carry_forward_surplus: c.carry_forward_surplus,
          missing_entry_hour: Math.max(0, Math.min(23, Number(c.missing_entry_hour) || 0)),
          wages_confirm_hour: Math.max(0, Math.min(23, Number(c.wages_confirm_hour) || 0)),
          supermarket_default_cash: Math.max(0, Number(c.supermarket_default_cash) || 0),
        },
      });
      toast.success("Cash flow settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
        <CardDescription>
          Opening-balance behaviour and the times that drive cash-flow alerts.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={c.carry_forward_surplus}
            onChange={(e) => setC((p) => ({ ...p, carry_forward_surplus: e.target.checked }))}
            className="h-4 w-4 accent-gold"
          />
          <span>Carry forward each week&apos;s surplus into the next week&apos;s opening balance</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="number"
            min="0"
            max="23"
            label="Missing-entry alert hour (0–23)"
            value={String(c.missing_entry_hour)}
            onChange={(e) => setC((p) => ({ ...p, missing_entry_hour: Number(e.target.value) }))}
            hint="Flag a store with no daily entry after this hour (e.g. 23 = 11pm)"
          />
          <Input
            type="number"
            min="0"
            max="23"
            label="Tuesday wages-confirm hour (0–23)"
            value={String(c.wages_confirm_hour)}
            onChange={(e) => setC((p) => ({ ...p, wages_confirm_hour: Number(e.target.value) }))}
            hint="Flag unconfirmed wages after this hour on Tuesday (e.g. 18 = 6pm)"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            label="Default supermarket cash (£)"
            prefix="£"
            value={String(c.supermarket_default_cash)}
            onChange={(e) => setC((p) => ({ ...p, supermarket_default_cash: Number(e.target.value) }))}
            hint="Added to every Tuesday payout as cash already in hand from supermarket takings (e.g. 700)"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} loading={busy}>Save cash flow settings</Button>
        </div>
      </div>
    </Card>
  );
}
