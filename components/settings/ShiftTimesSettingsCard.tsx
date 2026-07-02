"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateSettings } from "@/app/actions/settings";
import type { AppSettings, ShiftTimeSettings } from "@/lib/settings";

export function ShiftTimesSettingsCard({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [t, setT] = React.useState<ShiftTimeSettings>(initial.shift_times);
  const [busy, setBusy] = React.useState(false);

  function set(key: keyof ShiftTimeSettings, value: string) {
    setT((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    if (!t.driver_open || !t.kitchen_open || !t.evening_start || !t.close) {
      toast.error("All four times are required.");
      return;
    }
    setBusy(true);
    try {
      await updateSettings({ shift_times: t });
      toast.success("Shift times saved");
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
        <CardTitle>Shift times</CardTitle>
        <CardDescription>
          The Open / Evening / Close times used by the rota presets. Drivers open
          later than the kitchen. Changing these updates every new preset shift.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="time"
            label="Driver open"
            value={t.driver_open}
            onChange={(e) => set("driver_open", e.target.value)}
            hint="Drivers' start for an Open → Close shift (e.g. 11:30)"
          />
          <Input
            type="time"
            label="Kitchen open"
            value={t.kitchen_open}
            onChange={(e) => set("kitchen_open", e.target.value)}
            hint="Kitchen & other staff start for Open → Close (e.g. 09:00)"
          />
          <Input
            type="time"
            label="Evening start"
            value={t.evening_start}
            onChange={(e) => set("evening_start", e.target.value)}
            hint="Start of an Evening → Close shift (e.g. 17:00)"
          />
          <Input
            type="time"
            label="Close"
            value={t.close}
            onChange={(e) => set("close", e.target.value)}
            hint="Closing time — ends every preset shift (e.g. 23:00)"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} loading={busy}>Save shift times</Button>
        </div>
      </div>
    </Card>
  );
}
