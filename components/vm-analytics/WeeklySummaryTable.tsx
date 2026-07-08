import type { WeeklySummaryData } from "@/lib/vm-analytics/weekly-summary";

interface WeeklySummaryTableProps {
  data: WeeklySummaryData;
  store?: string | null;
}

function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return "—";
  return `£${value.toFixed(2)}`;
}

function formatPercent(value?: number): string {
  if (value === undefined || value === null) return "—";
  // Always show exactly 2 decimal places — never trim, so 45.70 stays "45.70%"
  // and not "45.7%". Multiplication is done in full float precision before
  // toFixed so the displayed figure matches the raw calculation.
  return `${(value * 100).toFixed(2)}%`;
}

function getRowClass(metric: string): string {
  const bold = [
    "Gross Sales",
    "Net Sales",
    "Gross Margin",
    "Store Contribution",
    "Net Margin",
  ];
  return bold.includes(metric) ? "font-semibold bg-surface-hover" : "";
}

export function WeeklySummaryTable({ data, store }: WeeklySummaryTableProps) {
  // When viewing Hitchin, the cogs_hitchin column actually holds Stevenage costs.
  const cogsLabel = (entity: string) =>
    entity === "COGS Hitchin" && store?.includes("Hitchin") ? "COGS Stevenage" : entity;
  return (
    <div className="vm-card overflow-hidden">
      <div className="table-scroll overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-hover">
            <th className="px-4 py-3 text-left font-semibold text-text-primary">Entity</th>
            <th className="px-4 py-3 text-right font-semibold text-text-primary">Actual</th>
            <th className="px-4 py-3 text-right font-semibold text-text-primary">Budget</th>
            <th className="px-4 py-3 text-right font-semibold text-text-primary">Variance</th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((metric, idx) => (
            <tr
              key={idx}
              className={`border-b border-border hover:bg-surface-hover/50 transition ${getRowClass(metric.entity)}`}
            >
              <td className="px-4 py-3 text-text-primary">{cogsLabel(metric.entity)}</td>
              <td className="px-4 py-3 text-right font-mono text-text-primary">
                {metric.actual !== undefined ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{formatCurrency(metric.actual)}</span>
                    {metric.actual_pct !== undefined && (
                      <span className="text-xs text-text-muted">
                        {formatPercent(metric.actual_pct)}
                      </span>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-primary">
                {metric.budget !== undefined ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{formatCurrency(metric.budget)}</span>
                    {metric.budget_pct !== undefined && (
                      <span className="text-xs text-text-muted">
                        {formatPercent(metric.budget_pct)}
                      </span>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-primary">
                {metric.variance !== undefined ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={metric.variance < 0 ? "text-red-600" : "text-green-600"}>
                      {formatCurrency(metric.variance)}
                    </span>
                    {metric.variance_pct !== undefined && (
                      <span className={`text-xs ${metric.variance_pct < 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatPercent(metric.variance_pct)}
                      </span>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Summary section */}
      {(data.totals.store_contribution !== undefined ||
        data.totals.net_margin !== undefined) && (
        <div className="border-t border-border bg-surface-hover px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
            {data.totals.store_contribution !== undefined && (
              <div>
                <div className="text-xs uppercase font-semibold text-text-muted mb-1">
                  Store Contribution
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(data.totals.store_contribution)}
                  </span>
                  {data.totals.store_contribution_pct !== undefined && (
                    <span className="text-sm text-text-secondary">
                      {formatPercent(data.totals.store_contribution_pct)}
                    </span>
                  )}
                </div>
              </div>
            )}
            {data.totals.net_margin !== undefined && (
              <div>
                <div className="text-xs uppercase font-semibold text-text-muted mb-1">
                  Net Margin
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(data.totals.net_margin)}
                  </span>
                  {data.totals.net_margin_pct !== undefined && (
                    <span className="text-sm text-text-secondary">
                      {formatPercent(data.totals.net_margin_pct)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
