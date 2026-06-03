"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateSettings } from "@/app/actions/settings";
import type {
  AlertThresholds,
  AppSettings,
  EmailAlertSettings,
  MinWageBands,
} from "@/lib/settings";

export function AlertSettingsCard({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [t, setT] = React.useState<AlertThresholds>(initial.alert_thresholds);
  const [w, setW] = React.useState<MinWageBands>(initial.min_wage_bands);
  const [e, setE] = React.useState<EmailAlertSettings>(initial.email_alerts);
  const [recipientsText, setRecipientsText] = React.useState(
    initial.email_alerts.recipients.join(", "),
  );
  const [busy, setBusy] = React.useState(false);

  const numT = (k: keyof AlertThresholds, v: string) =>
    setT((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));
  const numW = (k: keyof MinWageBands, v: string) =>
    setW((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));

  async function save() {
    setBusy(true);
    try {
      const recipients = recipientsText
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await updateSettings({
        alert_thresholds: {
          wage_variance_pct: Number(t.wage_variance_pct),
          delivery_spike_multiplier: Number(t.delivery_spike_multiplier),
          late_clock_in_min: Number(t.late_clock_in_min),
          absence_min: Number(t.absence_min),
          early_clock_out_min: Number(t.early_clock_out_min),
          scheduled_vs_actual_pct: Number(t.scheduled_vs_actual_pct),
        },
        min_wage_bands: {
          enabled: w.enabled,
          nlw_21_plus: Number(w.nlw_21_plus),
          age_18_20: Number(w.age_18_20),
          under_18: Number(w.under_18),
          effective_label: w.effective_label,
        },
        email_alerts: { enabled: e.enabled, recipients },
      });
      toast.success("Alert settings saved");
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
        <CardTitle>Alerts & Compliance</CardTitle>
        <CardDescription>
          Tune when the system raises alerts, set the minimum-wage bands, and
          control email notifications. Applies the next time alerts are scanned.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-6">
        {/* Alert thresholds */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-3">
            Alert thresholds
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Input
              type="number"
              step="1"
              min="0"
              label="Hours variance (%)"
              value={String(t.wage_variance_pct)}
              onChange={(ev) => numT("wage_variance_pct", ev.target.value)}
              hint="Week vs 4-week avg"
            />
            <Input
              type="number"
              step="0.1"
              min="1"
              label="Delivery spike (×)"
              value={String(t.delivery_spike_multiplier)}
              onChange={(ev) => numT("delivery_spike_multiplier", ev.target.value)}
              hint="Week vs 4-week avg"
            />
            <Input
              type="number"
              step="1"
              min="0"
              label="Scheduled vs actual (%)"
              value={String(t.scheduled_vs_actual_pct)}
              onChange={(ev) => numT("scheduled_vs_actual_pct", ev.target.value)}
            />
            <Input
              type="number"
              step="1"
              min="0"
              label="Late clock-in (min)"
              value={String(t.late_clock_in_min)}
              onChange={(ev) => numT("late_clock_in_min", ev.target.value)}
            />
            <Input
              type="number"
              step="1"
              min="0"
              label="Absence (min)"
              value={String(t.absence_min)}
              onChange={(ev) => numT("absence_min", ev.target.value)}
              hint="No-show past start"
            />
            <Input
              type="number"
              step="1"
              min="0"
              label="Early clock-out (min)"
              value={String(t.early_clock_out_min)}
              onChange={(ev) => numT("early_clock_out_min", ev.target.value)}
            />
          </div>
        </div>

        {/* Minimum wage */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs uppercase tracking-wider text-text-muted">
              Minimum wage bands (£/h)
            </h4>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={w.enabled}
                onChange={(ev) => setW((p) => ({ ...p, enabled: ev.target.checked }))}
                className="h-4 w-4 accent-gold"
              />
              <span>Check pay against minimum wage</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              type="number"
              step="0.01"
              min="0"
              prefix="£"
              label="21 and over (NLW)"
              value={String(w.nlw_21_plus)}
              onChange={(ev) => numW("nlw_21_plus", ev.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              prefix="£"
              label="18–20"
              value={String(w.age_18_20)}
              onChange={(ev) => numW("age_18_20", ev.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              prefix="£"
              label="Under 18"
              value={String(w.under_18)}
              onChange={(ev) => numW("under_18", ev.target.value)}
            />
            <Input
              label="Rates effective"
              value={w.effective_label}
              onChange={(ev) => setW((p) => ({ ...p, effective_label: ev.target.value }))}
              hint="e.g. April 2025"
            />
          </div>
        </div>

        {/* Email notifications */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs uppercase tracking-wider text-text-muted">
              Email notifications
            </h4>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={e.enabled}
                onChange={(ev) => setE((p) => ({ ...p, enabled: ev.target.checked }))}
                className="h-4 w-4 accent-gold"
              />
              <span>Email a digest of new alerts</span>
            </label>
          </div>
          <Textarea
            label="Recipients"
            rows={2}
            value={recipientsText}
            onChange={(ev) => setRecipientsText(ev.target.value)}
            placeholder="ops@peckers.co.uk, owner@peckers.co.uk"
            hint="Comma-separated real inboxes. Leave blank to email all admin accounts. Requires RESEND_API_KEY in the server environment."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} loading={busy}>
            Save alert settings
          </Button>
        </div>
      </div>
    </Card>
  );
}
