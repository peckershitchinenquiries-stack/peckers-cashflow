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
    <Card className="h-full max-sm:p-0 max-sm:overflow-hidden">
      <div className="max-sm:px-4 max-sm:pt-4">
      <CardHeader>
        <CardTitle>Recent Entries</CardTitle>
        <CardDescription>Last 7 days{storeName ? ` · ${storeName}` : ""}</CardDescription>
      </CardHeader>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListIcon />}
          title="No entries yet"
          description="Once managers start logging daily cash, the most recent entries will appear here."
        />
      ) : (
        <>
        <ul className="sm:hidden divide-y divide-border border-t border-border">
          {rows.map((r) => {
            const balanced = Math.abs(Number(r.difference)) < 0.001;
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                      {formatDDMMYYYY(r.entry_date)}
                      {r.is_late && (
                        <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                          Late
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {r.manager_name || "—"} · {formatDateTimeShort(r.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-text-primary">
                      {formatGBP(r.vita_mojo_sales)}
                    </p>
                    <p className="text-[11px] text-text-muted tabular-nums mt-0.5">
                      Exp {formatGBP(r.supermarket_expenses)} ·{" "}
                      <span
                        className={
                          balanced ? "text-text-muted" : Number(r.difference) > 0 ? "text-danger" : "text-warning"
                        }
                      >
                        Diff {formatGBP(r.difference)}
                      </span>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden sm:block overflow-x-auto -mx-1">
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
        </>
      )}
    </Card>
  );
}
