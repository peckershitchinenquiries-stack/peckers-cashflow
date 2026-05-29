"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { resolveAlert, scanForAlerts } from "@/app/actions/alerts";
import { formatDDMMYYYY, formatTimeOnly } from "@/lib/utils";
import type { Employee, Store, SystemAlert } from "@/lib/types";
import { CheckIcon } from "@/components/ui/icons";

const ALERT_LABELS: Record<string, { title: string; variant: "warning" | "danger" | "neutral" | "gold" }> = {
  wage_variance: { title: "Wage variance", variant: "warning" },
  delivery_payout_high: { title: "High delivery payout", variant: "warning" },
  delivery_unassigned: { title: "Unassigned deliveries", variant: "warning" },
  late_clock_in: { title: "Late clock-in", variant: "warning" },
  unexpected_absence: { title: "Unexpected absence", variant: "danger" },
  early_clock_out: { title: "Early clock-out", variant: "warning" },
  scheduled_vs_actual: { title: "Scheduled vs actual", variant: "neutral" },
};

export function AlertsView({
  initialAlerts,
  stores,
  employees,
}: {
  initialAlerts: SystemAlert[];
  stores: Store[];
  employees: Employee[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [showResolved, setShowResolved] = React.useState(false);
  const [storeFilter, setStoreFilter] = React.useState<string>("all");
  const [resolving, setResolving] = React.useState<SystemAlert | null>(null);
  const [note, setNote] = React.useState("");

  const storeById = new Map(stores.map((s) => [s.id, s]));
  const empById = new Map(employees.map((e) => [e.id, e]));

  const filtered = initialAlerts.filter((a) => {
    if (!showResolved && a.resolved) return false;
    if (storeFilter !== "all" && a.store_id !== storeFilter) return false;
    return true;
  });

  const openCount = initialAlerts.filter((a) => !a.resolved).length;

  async function runScan() {
    setScanning(true);
    try {
      await scanForAlerts();
      toast.success("Scan complete");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setScanning(false);
    }
  }

  async function doResolve() {
    if (!resolving) return;
    setBusyId(resolving.id);
    try {
      await resolveAlert({ id: resolving.id, note });
      toast.success("Resolved");
      setResolving(null);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={openCount > 0 ? "warning" : "success"}>
            {openCount} open
          </Badge>
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-gold hover:underline"
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-surface border border-border text-sm"
          >
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={runScan} loading={scanning}>
          Scan now
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted text-center py-10">
            No alerts {showResolved ? "" : "open"}. Click &quot;Scan now&quot; to check
            for new issues.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((a) => {
            const meta = ALERT_LABELS[a.alert_type] ?? {
              title: a.alert_type,
              variant: "neutral",
            };
            const store = a.store_id ? storeById.get(a.store_id) : null;
            const emp = a.employee_id ? empById.get(a.employee_id) : null;
            return (
              <Card
                key={a.id}
                className={a.resolved ? "opacity-70" : ""}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={meta.variant}>{meta.title}</Badge>
                      {store && <Badge variant="neutral">{store.name}</Badge>}
                      {a.resolved && <Badge variant="success">Resolved</Badge>}
                      <span className="text-xs text-text-muted">
                        {formatDDMMYYYY(a.created_at)} · {formatTimeOnly(a.created_at)}
                      </span>
                    </div>
                    <h3 className="font-medium mt-2 text-text-primary">
                      {a.title}
                    </h3>
                    <p className="text-sm text-text-subtle mt-1">{a.message}</p>
                    {a.resolution_note && (
                      <p className="text-xs text-success mt-2">
                        Resolved: {a.resolution_note}
                      </p>
                    )}
                  </div>
                  {!a.resolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResolving(a)}
                      iconLeft={<CheckIcon size={14} />}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolve modal */}
      {resolving && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setResolving(null)}
          />
          <div className="relative w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-5">
            <h3 className="font-semibold mb-2">Resolve alert</h3>
            <p className="text-sm text-text-muted mb-3">{resolving.title}</p>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional resolution note"
              className="w-full rounded-xl bg-bg border border-border px-3 py-2 text-sm outline-none focus:border-gold/60"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setResolving(null)}>
                Cancel
              </Button>
              <Button
                onClick={doResolve}
                loading={busyId === resolving.id}
              >
                Mark resolved
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
