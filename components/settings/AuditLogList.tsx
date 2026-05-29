"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDDMMYYYY, formatTimeOnly } from "@/lib/utils";
import type { AuditLogEntry } from "@/lib/types";

export function AuditLogList({ entries }: { entries: AuditLogEntry[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>
          Last 50 changes. Records every rate/rota/shift edit with the user who
          made it.
        </CardDescription>
      </CardHeader>
      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-2 py-2">When</th>
                <th className="text-left px-2 py-2">Actor</th>
                <th className="text-left px-2 py-2">Action</th>
                <th className="text-left px-2 py-2">Entity</th>
                <th className="text-right px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <React.Fragment key={e.id}>
                  <tr className="border-t border-border">
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-text-subtle">
                      {formatDDMMYYYY(e.created_at)} ·{" "}
                      {formatTimeOnly(e.created_at)}
                    </td>
                    <td className="px-2 py-2 text-text-subtle">
                      {e.actor_email ?? "system"}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant="neutral">{e.action}</Badge>
                    </td>
                    <td className="px-2 py-2 text-text-subtle">
                      {e.entity}
                      {e.entity_id && (
                        <span className="text-text-muted ml-1 text-xs">
                          ({e.entity_id.slice(0, 8)})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {e.changes && (
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === e.id ? null : e.id)
                          }
                          className="text-xs text-gold hover:underline"
                        >
                          {expandedId === e.id ? "Hide" : "Show"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === e.id && e.changes && (
                    <tr className="border-t border-border bg-surface-hover/40">
                      <td colSpan={5} className="px-3 py-2">
                        <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(e.changes, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
