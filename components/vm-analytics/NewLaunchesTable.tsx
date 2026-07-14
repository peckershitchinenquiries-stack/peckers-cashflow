import { int, gbp, signedPct, deltaClass } from "@/lib/vm-analytics/format";

export interface NewLaunchDisplayRow {
  item: string;
  units: number;
  revenue: number;
  revWow: number | null;
}

// Flat table of curated new-launch items for the selected week. Mirrors the
// CategoryPerformanceTable styling but has no drill-down — one row per launch.
export function NewLaunchesTable({ rows }: { rows: NewLaunchDisplayRow[] }) {
  return (
    <div className="vm-table-container">
      <div className="table-scroll overflow-x-auto">
        <table className="vm-table text-sm">
          <thead>
            <tr className="bg-surface-hover text-secondary">
              <th className="whitespace-nowrap px-4 py-3 font-semibold uppercase text-xs tracking-wide border-b border-line text-left">
                Name
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold uppercase text-xs tracking-wide border-b border-line text-right">
                Units Sold
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold uppercase text-xs tracking-wide border-b border-line text-right">
                Revenue
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold uppercase text-xs tracking-wide border-b border-line text-right">
                Revenue WoW
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-tertiary">
                  No new launches with sales this week.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.item} className="hover:bg-surface-hover">
                  <td className="whitespace-nowrap px-4 py-3 text-primary text-left font-medium">
                    {r.item}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-primary text-right tabular-nums">
                    {int(r.units)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-primary text-right tabular-nums">
                    {gbp(r.revenue)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    <span className={deltaClass(r.revWow)}>{signedPct(r.revWow)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
