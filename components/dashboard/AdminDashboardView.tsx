"use client";

import * as React from "react";
import type { StoreDashboard } from "@/lib/dashboard/types";
import { LastWeekPerformanceCard } from "./LastWeekPerformanceCard";
import { PayoutCard } from "./PayoutCard";
import { NeedsActionPanel } from "./NeedsActionPanel";

/**
 * The two stores are separate businesses — figures are never combined; the
 * admin switches between them with the toggle.
 */
export function AdminDashboardView({
  stores,
  today,
}: {
  stores: StoreDashboard[];
  today: string;
}) {
  const [activeId, setActiveId] = React.useState(stores[0]?.store.id ?? "");
  const active = stores.find((s) => s.store.id === activeId) ?? stores[0];

  if (!active) {
    return (
      <p className="text-sm text-text-muted">
        No stores configured yet. Add stores in Settings.
      </p>
    );
  }

  const thisTuesday = <PayoutCard data={active.thisTuesday} kind="this" today={today} />;
  const nextTuesday = <PayoutCard data={active.nextTuesday} kind="next" today={today} />;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
        {stores.map(({ store }) => (
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

      <LastWeekPerformanceCard data={active.performance} />

      {/* Mobile reads top-down: this Tuesday, what's blocking it, then next week's forecast. */}
      {/* Desktop stretches the row so all three cards share top and bottom edges. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start lg:items-stretch">
        <div className="order-1 lg:h-full">{thisTuesday}</div>
        <div className="order-3 lg:order-2 lg:h-full">{nextTuesday}</div>
        <div className="order-2 lg:order-3 lg:h-full">
          <NeedsActionPanel data={active.needsAction} />
        </div>
      </div>
    </div>
  );
}
