"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateStore } from "@/app/actions/stores";
import type { Store } from "@/lib/types";

export function StoresAdmin({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState<Record<string, Partial<Store>>>(
    {},
  );
  const [busy, setBusy] = React.useState<string | null>(null);

  function setField(id: string, field: keyof Store, value: unknown) {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function save(store: Store) {
    const changes = editing[store.id];
    if (!changes) return;
    setBusy(store.id);
    try {
      await updateStore({
        id: store.id,
        latitude:
          changes.latitude !== undefined ? Number(changes.latitude) : undefined,
        longitude:
          changes.longitude !== undefined
            ? Number(changes.longitude)
            : undefined,
        geofence_radius_m:
          changes.geofence_radius_m !== undefined
            ? Number(changes.geofence_radius_m)
            : undefined,
      });
      toast.success(`${store.name} updated`);
      setEditing((prev) => {
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
        <CardTitle>Stores & Geofencing</CardTitle>
        <CardDescription>
          Crew can only clock in within the configured radius of these
          coordinates.
        </CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-5">
        {stores.map((s) => {
          const draft = editing[s.id];
          const lat = draft?.latitude ?? s.latitude ?? "";
          const lng = draft?.longitude ?? s.longitude ?? "";
          const rad = draft?.geofence_radius_m ?? s.geofence_radius_m ?? 250;
          const hasChanges = !!draft;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-border p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-medium">{s.name}</h4>
                  <p className="text-xs text-text-muted">Code: {s.code}</p>
                </div>
                {hasChanges && (
                  <Button
                    size="sm"
                    onClick={() => save(s)}
                    loading={busy === s.id}
                  >
                    Save
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  type="number"
                  step="0.0000001"
                  label="Latitude"
                  value={String(lat)}
                  onChange={(e) =>
                    setField(s.id, "latitude", e.target.value)
                  }
                />
                <Input
                  type="number"
                  step="0.0000001"
                  label="Longitude"
                  value={String(lng)}
                  onChange={(e) =>
                    setField(s.id, "longitude", e.target.value)
                  }
                />
                <Input
                  type="number"
                  min="50"
                  label="Geofence radius (m)"
                  value={String(rad)}
                  onChange={(e) =>
                    setField(s.id, "geofence_radius_m", e.target.value)
                  }
                  hint="2–3 min walk ≈ 200–300m"
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
