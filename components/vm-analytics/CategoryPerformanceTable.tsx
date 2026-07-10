"use client";

import { Fragment, useState } from "react";
import { int, gbp, signedPct, deltaClass } from "@/lib/vm-analytics/format";

export interface CategoryItem {
  item: string;
  units: number;
  revenue: number;
  revWow: number | null;
}

export interface CategoryPerf {
  category: string;
  units: number;
  revenue: number;
  revWow: number | null;
  items: CategoryItem[];
}

export function CategoryPerformanceTable({ rows }: { rows: CategoryPerf[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (category: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });

  return (
    <div className="vm-table-container">
      <div className="table-scroll overflow-x-auto">
        <table className="vm-table text-sm">
          <thead>
            <tr className="bg-surface-hover text-secondary">
              <th className="whitespace-nowrap px-4 py-3 font-semibold uppercase text-xs tracking-wide border-b border-line text-left">
                Category
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
                  No data for this week.
                </td>
              </tr>
            ) : (
              rows.map((cat) => {
                const isOpen = expanded.has(cat.category);
                return (
                  <Fragment key={cat.category}>
                    <tr
                      onClick={() => toggle(cat.category)}
                      className="cursor-pointer hover:bg-surface-hover"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-primary text-left font-medium">
                        <span className="mr-2 inline-block w-3 text-tertiary">
                          {isOpen ? "▾" : "▸"}
                        </span>
                        {cat.category}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-primary text-right tabular-nums">
                        {int(cat.units)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-primary text-right tabular-nums">
                        {gbp(cat.revenue)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <span className={deltaClass(cat.revWow)}>{signedPct(cat.revWow)}</span>
                      </td>
                    </tr>
                    {isOpen &&
                      cat.items.map((it) => (
                        <tr key={`${cat.category}::${it.item}`} className="bg-surface-hover/40">
                          <td className="whitespace-nowrap px-4 py-2 pl-8 text-secondary text-left text-xs">
                            {it.item}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-secondary text-right tabular-nums text-xs">
                            {int(it.units)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-secondary text-right tabular-nums text-xs">
                            {gbp(it.revenue)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-xs">
                            <span className={deltaClass(it.revWow)}>{signedPct(it.revWow)}</span>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
