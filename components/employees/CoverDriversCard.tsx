"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { PlusIcon, TrashIcon, ClockIcon } from "@/components/ui/icons";
import { AddCoverDriverModal } from "./AddCoverDriverModal";
import { deleteCoverDriverRecord } from "@/app/actions/cover-drivers";
import { formatDDMMYYYY, formatGBP } from "@/lib/utils";
import type { CoverDriverRecord, Store } from "@/lib/types";

export function CoverDriversCard({
  records,
  stores,
  defaultStoreId,
  lockToStore = false,
  showStoreColumn = false,
  onCreated,
  onDeleted,
}: {
  records: CoverDriverRecord[];
  stores: Store[];
  defaultStoreId?: string | null;
  lockToStore?: boolean;
  /** Admin (all-stores view): show which store each record belongs to. */
  showStoreColumn?: boolean;
  onCreated: (record: CoverDriverRecord) => void;
  onDeleted: (deletedId: string) => void;
}) {
  const toast = useToast();
  const [showAdd, setShowAdd] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const storeName = React.useMemo(() => {
    const map = new Map(stores.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [stores]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this cover driver record?")) return;
    setDeletingId(id);
    try {
      await deleteCoverDriverRecord(id);
      toast.success("Record deleted");
      onDeleted(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        action={
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            iconLeft={<PlusIcon size={16} />}
          >
            Add Cover Driver
          </Button>
        }
      >
        <CardTitle>Cover Drivers</CardTitle>
        <CardDescription>
          Ad-hoc payments to part-time cover drivers (not permanent employees).
        </CardDescription>
      </CardHeader>

      {records.length === 0 ? (
        <EmptyState
          icon={<ClockIcon />}
          title="No cover drivers recorded"
          description="Use “Add Cover Driver” to record a one-off payment for a part-time driver."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-b border-border">
                <th className="px-3 py-2 font-medium">Driver</th>
                {showStoreColumn && <th className="px-3 py-2 font-medium">Store</th>}
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Hours</th>
                <th className="px-3 py-2 font-medium text-right">Rate</th>
                <th className="px-3 py-2 font-medium text-right">Total pay</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${i % 2 === 0 ? "" : "bg-bg/50"} border-t border-border/60`}
                >
                  <td className="px-3 py-3 whitespace-nowrap font-medium">{r.driver_name}</td>
                  {showStoreColumn && (
                    <td className="px-3 py-3 whitespace-nowrap text-text-muted">
                      {storeName(r.store_id)}
                    </td>
                  )}
                  <td className="px-3 py-3 whitespace-nowrap">{formatDDMMYYYY(r.work_date)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {Number(r.hours_worked).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatGBP(r.hourly_rate)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <Badge variant="gold">{formatGBP(r.total_pay)}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r.id)}
                      loading={deletingId === r.id}
                      aria-label="Delete cover driver record"
                      className="text-text-muted hover:text-danger"
                    >
                      <TrashIcon size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddCoverDriverModal
          stores={stores}
          defaultStoreId={defaultStoreId}
          lockStore={lockToStore}
          onClose={() => setShowAdd(false)}
          onCreated={(record) => {
            setShowAdd(false);
            onCreated(record);
          }}
        />
      )}
    </Card>
  );
}
