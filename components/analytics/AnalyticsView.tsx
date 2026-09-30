"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Only one tab is ever on screen, but a static import of both shipped both
// subtrees -- and recharts with them -- in the route's initial chunk. Split so
// each tab's code arrives when that tab is first shown.
//
// ssr stays TRUE deliberately: it gives the same saving as ssr:false here, and
// keeps server rendering and the views' own loading states exactly as they
// were. ssr:false would have introduced a placeholder that flashes before the
// view's own skeleton -- a visible change for no extra benefit.
const WeeklyView = dynamic(() => import("./WeeklyView").then((m) => m.WeeklyView));
const MonthlyView = dynamic(() => import("./MonthlyView").then((m) => m.MonthlyView));

type StoreOpt = { id: string; name: string };

/**
 * The whole estate's roster, with the rates needed to price a week. Not grouped
 * by home store (Update 225): an employee's cash is owed by the store each shift
 * was worked at, and the home-store NI rule needs their FULL week to know which
 * hours fall inside the bank allowance.
 */
export type AnalyticsEmployee = {
  id: string;
  name: string;
  store_id: string | null;
  hourly_cash_rate: number | null;
  bank_weekly_hours_limit: number | null;
};

/**
 * Analytics is always scoped to a single store — the two stores are separate
 * businesses and their figures are never combined. Admins switch stores with
 * the toggle; managers see only their own store.
 */
export function AnalyticsView({
  stores,
  employees,
  isAdmin,
  defaultStoreId,
}: {
  stores: StoreOpt[];
  employees: AnalyticsEmployee[];
  isAdmin: boolean;
  defaultStoreId: string;
}) {
  const [tab, setTab] = React.useState<"weekly" | "monthly">("weekly");
  const [storeId, setStoreId] = React.useState(defaultStoreId || stores[0]?.id || "");

  if (!storeId) {
    return <p className="text-sm text-text-muted">No store available.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5 sm:mb-6">
        <div className="grid grid-cols-2 w-full sm:w-auto sm:inline-flex p-1 rounded-xl bg-surface border border-border">
          <button
            onClick={() => setTab("weekly")}
            className={cn(
              "h-10 px-5 rounded-lg text-sm font-medium transition-all",
              tab === "weekly"
                ? "bg-bg text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            Weekly
          </button>
          <button
            onClick={() => setTab("monthly")}
            className={cn(
              "h-10 px-5 rounded-lg text-sm font-medium transition-all",
              tab === "monthly"
                ? "bg-bg text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            Monthly
          </button>
        </div>

        {/* Store toggle — figures are kept fully separate per store */}
        {isAdmin && stores.length > 1 && (
          <div className="grid grid-cols-2 w-full sm:w-auto sm:flex gap-2 sm:flex-wrap">
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => setStoreId(s.id)}
                className={cn(
                  "px-4 h-10 rounded-xl border text-sm font-medium transition-colors",
                  s.id === storeId
                    ? "bg-gold text-black border-gold"
                    : "bg-surface text-text-primary border-border hover:bg-surface-hover",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "weekly" ? (
        <WeeklyView storeId={storeId} employees={employees} />
      ) : (
        <MonthlyView storeId={storeId} employees={employees} />
      )}
    </div>
  );
}
