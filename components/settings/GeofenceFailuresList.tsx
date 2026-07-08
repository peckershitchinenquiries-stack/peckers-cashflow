"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDDMMYYYY, formatTimeOnly } from "@/lib/utils";
import type { GeofenceFailure } from "@/lib/types";

export function GeofenceFailuresList({ entries }: { entries: GeofenceFailure[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geofence Failures</CardTitle>
        <CardDescription>
          Last 50 failed clock-in/out attempts — who tried, where they actually
          were, and how far that was from the nearest store.
        </CardDescription>
      </CardHeader>
      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">No failed attempts recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-2 py-2">When</th>
                <th className="text-left px-2 py-2">Who</th>
                <th className="text-left px-2 py-2">Action</th>
                <th className="text-left px-2 py-2">Nearest store</th>
                <th className="text-right px-2 py-2">Distance</th>
                <th className="text-right px-2 py-2">GPS accuracy</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-text-subtle">
                    {formatDDMMYYYY(f.occurred_at)} · {formatTimeOnly(f.occurred_at)}
                  </td>
                  <td className="px-2 py-2 text-text-subtle">{f.actor_email}</td>
                  <td className="px-2 py-2">
                    <Badge variant="neutral">
                      {f.action === "clock_in" ? "Clock In" : "Clock Out"}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-text-subtle">
                    {f.nearest_store_name ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-danger">
                    {Math.round(f.distance_m)}m{" "}
                    <span className="text-text-muted">/ {f.radius_m}m</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-subtle">
                    {f.accuracy_m != null ? `±${Math.round(f.accuracy_m)}m` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
