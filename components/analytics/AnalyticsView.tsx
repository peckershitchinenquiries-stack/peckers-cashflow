"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";

type StoreOpt = { id: string; name: string };

/**
 * Analytics is always scoped to a single store — the two stores are separate
 * businesses and their figures are never combined. Admins switch stores with
 * the toggle; managers see only their own store.
 */
export function AnalyticsView({
  stores,
  employeesByStore,
  isAdmin,
  defaultStoreId,
}: {
  stores: StoreOpt[];
  employeesByStore: Record<string, string[]>;
  isAdmin: boolean;
  defaultStoreId: string;
}) {
  const [tab, setTab] = React.useState<"weekly" | "monthly">("weekly");
  const [storeId, setStoreId] = React.useState(defaultStoreId || stores[0]?.id || "");
  const employeeIds = employeesByStore[storeId] ?? [];

  if (!storeId) {
    return <p className="text-sm text-text-muted">No store available.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="inline-flex p-1 rounded-xl bg-surface border border-border">
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
          <div className="flex gap-2 flex-wrap">
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
        <WeeklyView storeId={storeId} employeeIds={employeeIds} />
      ) : (
        <MonthlyView storeId={storeId} employeeIds={employeeIds} />
      )}
    </div>
  );
}
