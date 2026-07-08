"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateStore } from "@/app/actions/stores";
import { getBestPosition, isPermissionDenied } from "@/lib/geolocation";
import type { Store } from "@/lib/types";

/** Worst GPS accuracy (± metres) we'll accept when capturing a store's location.
 *  Anything looser is a Wi-Fi/IP estimate that can be kilometres off — refuse it
 *  so a store can't be pinned from a laptop and break everyone's clock-in. */
const MAX_STORE_CAPTURE_ACCURACY_M = 100;

export function StoresAdmin({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState<Record<string, Partial<Store>>>(
    {},
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState<string | null>(null);

  function setField(id: string, field: keyof Store, value: unknown) {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  // Capture the device's current GPS position into a store's lat/lng fields.
  // Intended workflow: stand at the store's front door on a PHONE, click this,
  // then Save. Low-accuracy readings (a laptop's Wi-Fi/IP guess, which can be
  // kilometres off) are refused — pinning a store from one of those is exactly
  // how staff end up unable to clock in.
  function useCurrentLocation(store: Store) {
    setLocating(store.id);
    getBestPosition({ desiredAccuracyM: 20, maxWaitMs: 15_000 })
      .then((fix) => {
        setLocating(null);
        if (fix.accuracy > MAX_STORE_CAPTURE_ACCURACY_M) {
          toast.error(
            `Location is only accurate to ±${Math.round(fix.accuracy)}m — that's a Wi-Fi/network estimate, not GPS, and can be off by kilometres. Open this page on a phone with GPS, stand outside the store, and try again (or type the exact coordinates from Google Maps).`,
          );
          return;
        }
        setEditing((prev) => ({
          ...prev,
          [store.id]: {
            ...prev[store.id],
            latitude: Number(fix.lat.toFixed(7)),
            longitude: Number(fix.lng.toFixed(7)),
          },
        }));
        toast.success(`Captured (±${Math.round(fix.accuracy)}m). Review, then Save.`);
      })
      .catch((err: unknown) => {
        setLocating(null);
        toast.error(
          isPermissionDenied(err)
            ? "Location permission denied — allow it in your browser to capture coordinates."
            : err instanceof Error
              ? err.message
              : "Could not get your location.",
        );
      });
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
          Staff can only clock in/out within this radius of the store. Easiest
          setup: open this page on your phone while standing at the store, tap{" "}
          <span className="text-text-primary">Use my current location</span>,
          then Save.
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
                  <p className="text-xs text-text-muted">
                    Code: {s.code}
                    {s.latitude == null || s.longitude == null ? (
                      <span className="ml-2 text-danger">· coordinates not set</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useCurrentLocation(s)}
                    loading={locating === s.id}
                  >
                    Use my current location
                  </Button>
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
                  hint="Walk distance: 2–3 min ≈ 250m, 5 min ≈ 400m"
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
