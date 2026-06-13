import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  caption,
  emptyMessage = "No data for this week.",
}: {
  columns: Column<T>[];
  rows: T[];
  caption?: string;
  emptyMessage?: string;
}) {
  return (
    <div className="vm-table-container">
      {caption && (
        <div className="border-b border-line px-4 py-3 text-sm font-semibold bg-surface text-primary">
          {caption}
        </div>
      )}
      <div className="table-scroll overflow-x-auto">
        <table className="vm-table text-sm">
          <thead>
            <tr className="bg-surface-hover text-secondary">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-3 font-semibold uppercase text-xs tracking-wide border-b border-line ${
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                      ? "text-center"
                      : "text-left"
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-tertiary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-surface-hover">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-4 py-3 text-primary ${
                        c.align === "right"
                          ? "text-right tabular-nums"
                          : c.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
