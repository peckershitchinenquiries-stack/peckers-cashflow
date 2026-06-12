"use client";

import * as React from "react";
import { SummaryCards } from "./SummaryCards";
import { RecentEntriesTable } from "./RecentEntriesTable";

export type StoreDashboardData = {
  store: { id: string; name: string };
  /** Yesterday's cash sales for this store. */
  cashSale: number;
  /** Yesterday's supermarket expenses for this store. */
  expenses: number;
  /** cashSale − expenses. */
  remainingCash: number;
  /** Week's cash sales up to yesterday (today excluded). */
  weekCash: number;
  recent: {
    id: string;
    entry_date: string;
    store_name: string | null;
    manager_name: string | null;
    vita_mojo_sales: number;
    supermarket_expenses: number;
    difference: number;
    is_late: boolean;
  }[];
};

/**
 * Admin dashboard body with a store toggle. The two stores are completely
 * separate businesses — figures are never combined; the admin switches between
 * them with the tabs.
 */
export function AdminDashboardView({
  storeData,
  yesterdayLabel,
}: {
  storeData: StoreDashboardData[];
  yesterdayLabel: string;
}) {
  const [activeId, setActiveId] = React.useState(storeData[0]?.store.id ?? "");
  const active = storeData.find((s) => s.store.id === activeId) ?? storeData[0];

  if (!active) {
    return (
      <p className="text-sm text-text-muted">
        No stores configured yet. Add stores in Settings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Store toggle — each store's figures are kept fully separate */}
      <div className="flex gap-2 flex-wrap">
        {storeData.map(({ store }) => (
          <button
            key={store.id}
            onClick={() => setActiveId(store.id)}
            className={
              "px-4 h-10 rounded-xl border text-sm font-medium transition-colors " +
              (store.id === active.store.id
                ? "bg-gold text-black border-gold"
                : "bg-surface text-text-primary border-border hover:bg-surface-hover")
            }
          >
            {store.name}
          </button>
        ))}
      </div>

      <SummaryCards
        cashSale={active.cashSale}
        expenses={active.expenses}
        remainingCash={active.remainingCash}
        weekCash={active.weekCash}
        yesterdayLabel={yesterdayLabel}
      />

      <RecentEntriesTable rows={active.recent} storeName={active.store.name} />
    </div>
  );
}
