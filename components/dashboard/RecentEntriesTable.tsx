"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ListIcon } from "@/components/ui/icons";
import { formatDDMMYYYY, formatINR } from "@/lib/utils";

type Row = {
  id: string;
  entry_date: string;
  cash_sales: number;
  supermarket_expenses: number;
  notes: string | null;
  user_id: string | null;
  manager_name: string | null;
};

export function RecentEntriesTable({
  rows,
  currentUserId,
}: {
  rows: Row[];
  currentUserId: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Entries</CardTitle>
        <CardDescription>Last 7 days · all managers</CardDescription>
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListIcon />}
          title="No entries yet"
          description="Once you start logging daily cash, your most recent entries will appear here."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Manager</th>
                <th className="px-3 py-2 font-medium text-right">Sales</th>
                <th className="px-3 py-2 font-medium text-right">Expenses</th>
                <th className="px-3 py-2 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const net = Number(r.cash_sales) - Number(r.supermarket_expenses);
                return (
                  <tr
                    key={r.id}
                    className={`${
                      i % 2 === 0 ? "bg-transparent" : "bg-bg/50"
                    } border-t border-border/60 hover:bg-surface-hover/30 transition-colors`}
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDDMMYYYY(r.entry_date)}
                    </td>
                    <td className="px-3 py-3 truncate max-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">
                          {r.manager_name || "—"}
                        </span>
                        {r.user_id === currentUserId && (
                          <Badge variant="gold" className="text-[10px] py-0 px-1.5">
                            You
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatINR(r.cash_sales)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatINR(r.supermarket_expenses)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-medium ${
                        net >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatINR(net)}
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
