"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ListIcon } from "@/components/ui/icons";
import { formatDDMMYYYY, formatDateTimeShort, formatGBP } from "@/lib/utils";

type Row = {
  id: string;
  entry_date: string;
  store_name: string | null;
  manager_name: string | null;
  vita_mojo_sales: number;
  supermarket_expenses: number;
  difference: number;
  is_late: boolean;
  created_at: string;
};

export function RecentEntriesTable({
  rows,
  storeName,
}: {
  rows: Row[];
  storeName?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Entries</CardTitle>
        <CardDescription>Last 7 days{storeName ? ` · ${storeName}` : ""}</CardDescription>
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListIcon />}
          title="No entries yet"
          description="Once managers start logging daily cash, the most recent entries will appear here."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Logged</th>
                <th className="px-3 py-2 font-medium">Manager</th>
                <th className="px-3 py-2 font-medium text-right">Sales</th>
                <th className="px-3 py-2 font-medium text-right">Expenses</th>
                <th className="px-3 py-2 font-medium text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const balanced = Math.abs(Number(r.difference)) < 0.001;
                return (
                  <tr
                    key={r.id}
                    className={`${
                      i % 2 === 0 ? "bg-transparent" : "bg-bg/50"
                    } border-t border-border/60 hover:bg-surface-hover/30 transition-colors`}
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDDMMYYYY(r.entry_date)}
                      {r.is_late && (
                        <Badge variant="warning" className="ml-2 text-[10px] py-0 px-1.5">
                          Late
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-text-muted tabular-nums">
                      {formatDateTimeShort(r.created_at)}
                    </td>
                    <td className="px-3 py-3 truncate max-w-[160px]" title={r.store_name ?? undefined}>
                      {r.manager_name || "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatGBP(r.vita_mojo_sales)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatGBP(r.supermarket_expenses)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-medium ${
                        balanced ? "text-text-muted" : Number(r.difference) > 0 ? "text-danger" : "text-warning"
                      }`}
                    >
                      {formatGBP(r.difference)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
