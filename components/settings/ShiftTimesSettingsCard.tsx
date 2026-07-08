"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateStore } from "@/app/actions/stores";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { Store, StoreShiftTimes } from "@/lib/types";

/** Per-store rota preset times. Each store trades on its own hours, so the
 *  Open/Evening/Close times are configured separately for every store. */
export function ShiftTimesSettingsCard({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const toast = useToast();
  // Draft edits keyed by store id; a store is dirty once it has an entry here.
  const [edits, setEdits] = React.useState<Record<string, StoreShiftTimes>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  function timesFor(s: Store): StoreShiftTimes {
    return edits[s.id] ?? s.shift_times ?? DEFAULT_SETTINGS.shift_times;
  }

  function set(store: Store, key: keyof StoreShiftTimes, value: string) {
    setEdits((prev) => ({
      ...prev,
      [store.id]: { ...timesFor(store), [key]: value },
    }));
  }

  async function save(store: Store) {
    const t = edits[store.id];
    if (!t) return;
    if (!t.driver_open || !t.kitchen_open || !t.evening_start || !t.close) {
      toast.error("All four times are required.");
      return;
    }
    setBusy(store.id);
    try {
      await updateStore({ id: store.id, shift_times: t });
      toast.success(`${store.name} shift times saved`);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[store.id];
        return next;
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift times</CardTitle>
        <CardDescription>
          The Open / Evening / Close times used by each store's rota presets.
          Every store can set its own hours — drivers open later than the
          kitchen. Changing these updates every new preset shift for that store.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-5">
        {stores.map((s) => {
          const t = timesFor(s);
          const dirty = !!edits[s.id];
          return (
            <div
              key={s.id}
              className="rounded-xl border border-border p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-medium">{s.name}</h4>
                {dirty && (
                  <Button size="sm" onClick={() => save(s)} loading={busy === s.id}>
                    Save
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="time"
                  label="Driver open"
                  value={t.driver_open}
                  onChange={(e) => set(s, "driver_open", e.target.value)}
                  hint="Drivers' start for an Open → Close shift (e.g. 11:30)"
                />
                <Input
                  type="time"
                  label="Kitchen open"
                  value={t.kitchen_open}
                  onChange={(e) => set(s, "kitchen_open", e.target.value)}
                  hint="Kitchen & other staff start for Open → Close (e.g. 09:00)"
                />
                <Input
                  type="time"
                  label="Evening start"
                  value={t.evening_start}
                  onChange={(e) => set(s, "evening_start", e.target.value)}
                  hint="Start of an Evening → Close shift (e.g. 17:00)"
                />
                <Input
                  type="time"
                  label="Close"
                  value={t.close}
                  onChange={(e) => set(s, "close", e.target.value)}
                  hint="Closing time — ends every preset shift (e.g. 23:00)"
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
