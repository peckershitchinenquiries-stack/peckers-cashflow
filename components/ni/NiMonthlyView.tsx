"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/ui/icons";
import { downloadCSV, formatGBP, formatGBPPlain, toCSV } from "@/lib/utils";

export type NiRow = {
  store_id: string | null;
  /** YYYY-MM month key (month of the week's Monday). */
  month: string;
  employee_id: string;
  employee_name: string;
  ni_hours: number;
  ni_wages: number;
};

type StoreOpt = { id: string; name: string };

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

/**
 * NI (PAYE) wages grouped by calendar month. NI is paid monthly; cash weekly.
 * Admins toggle between stores (each store's figures stay fully separate);
 * managers see only their own store. Exportable as CSV or PDF (print).
 */
export function NiMonthlyView({
  rows,
  stores,
  isAdmin,
}: {
  rows: NiRow[];
  stores: StoreOpt[];
  isAdmin: boolean;
}) {
  const [activeStoreId, setActiveStoreId] = React.useState(stores[0]?.id ?? "");
  const activeStore = stores.find((s) => s.id === activeStoreId) ?? stores[0];

  const storeRows = React.useMemo(
    () => rows.filter((r) => r.store_id === activeStore?.id),
    [rows, activeStore?.id],
  );

  // month -> employee -> aggregated totals
  const byMonth = React.useMemo(() => {
    const m = new Map<string, Map<string, NiRow>>();
    for (const r of storeRows) {
      if (!m.has(r.month)) m.set(r.month, new Map());
      const emp = m.get(r.month)!;
      const existing = emp.get(r.employee_id);
      if (existing) {
        existing.ni_hours += r.ni_hours;
        existing.ni_wages += r.ni_wages;
      } else {
        emp.set(r.employee_id, { ...r });
      }
    }
    return m;
  }, [storeRows]);

  const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

  function exportCSV() {
    const headers = ["Month", "Store", "Employee", "NI hours", "NI wages (PAYE)"];
    const out: (string | number)[][] = [];
    for (const mk of months) {
      for (const e of Array.from(byMonth.get(mk)!.values()).sort((a, b) =>
        a.employee_name.localeCompare(b.employee_name),
      )) {
        out.push([
          monthLabel(mk),
          activeStore?.name ?? "",
          e.employee_name,
          e.ni_hours.toFixed(2),
          formatGBPPlain(e.ni_wages),
        ]);
      }
    }
    downloadCSV(
      `peckers-ni-monthly-${(activeStore?.name ?? "store").toLowerCase().replace(/\s+/g, "-")}.csv`,
      toCSV(headers, out),
    );
  }

  if (!activeStore) {
    return (
      <Card>
        <p className="text-sm text-text-muted">No stores configured.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Store toggle (admin) + export actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex gap-2 flex-wrap">
          {isAdmin && stores.length > 1 ? (
            stores.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStoreId(s.id)}
                className={
                  "px-4 h-10 rounded-xl border text-sm font-medium transition-colors " +
                  (s.id === activeStore.id
                    ? "bg-gold text-black border-gold"
                    : "bg-surface text-text-primary border-border hover:bg-surface-hover")
                }
              >
                {s.name}
              </button>
            ))
          ) : (
            <p className="text-sm text-text-muted self-center">{activeStore.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={exportCSV}
            iconLeft={<DownloadIcon size={16} />}
            disabled={months.length === 0}
          >
            CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.print()}
            disabled={months.length === 0}
          >
            PDF
          </Button>
        </div>
      </div>

      {months.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No approved hours for {activeStore.name} yet. Approve clocked hours on the
            Employees page and they will appear here.
          </p>
        </Card>
      ) : (
        months.map((mk) => {
          const emps = Array.from(byMonth.get(mk)!.values()).sort((a, b) =>
            a.employee_name.localeCompare(b.employee_name),
          );
          const hoursTotal = emps.reduce((s, e) => s + e.ni_hours, 0);
          const niTotal = emps.reduce((s, e) => s + e.ni_wages, 0);
          return (
            <Card key={mk} className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-text-primary">
                  {monthLabel(mk)} — {activeStore.name}
                </h2>
                <div className="text-right">
                  <p className="text-xs text-text-muted">NI (PAYE) total</p>
                  <p className="text-lg font-semibold text-gold tabular-nums">
                    {formatGBP(niTotal)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-text-muted bg-bg/50">
                      <th className="px-4 py-2.5 font-medium">Employee</th>
                      <th className="px-4 py-2.5 font-medium text-right">NI hours</th>
                      <th className="px-4 py-2.5 font-medium text-right">NI wages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emps.map((e, i) => (
                      <tr
                        key={e.employee_id}
                        className={`${i % 2 === 0 ? "" : "bg-bg/40"} border-t border-border/60`}
                      >
                        <td className="px-4 py-2.5 font-medium">{e.employee_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {e.ni_hours.toFixed(1)}h
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatGBP(e.ni_wages)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-bg/60 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {hoursTotal.toFixed(1)}h
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gold">
                        {formatGBP(niTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
