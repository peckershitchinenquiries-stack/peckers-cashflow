"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";

export function AnalyticsView() {
  const [tab, setTab] = React.useState<"weekly" | "monthly">("weekly");

  return (
    <div>
      <div className="inline-flex p-1 rounded-xl bg-surface border border-border mb-6">
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

      {tab === "weekly" ? <WeeklyView /> : <MonthlyView />}
    </div>
  );
}
