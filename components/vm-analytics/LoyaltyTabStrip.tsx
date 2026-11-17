"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOYALTY_TABS, type LoyaltyTab } from "@/lib/vm-analytics/loyalty-tabs";
import { startTopProgress, finishTopProgress } from "@/components/layout/TopProgressBar";
import { LoyaltyTabSkeleton } from "./LoyaltyTabSkeleton";

// ?tab= on the one route, so the layout's week and store pickers (which keep
// every other parameter) apply to whichever tab is open. Wraps the tab content
// so a click swaps to the new tab's skeleton at once instead of leaving the old
// tab on screen for the whole server round trip.
export function LoyaltyTabs({ active, children }: { active: LoyaltyTab; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [pending, startTransition] = React.useTransition();
  const [clicked, setClicked] = React.useState<LoyaltyTab | null>(null);
  const loading = pending && clicked !== null && clicked !== active;
  const shown = loading ? clicked : active;

  const wasPending = React.useRef(false);
  React.useEffect(() => {
    if (wasPending.current && !pending) finishTopProgress();
    wasPending.current = pending;
  }, [pending]);

  function go(tab: LoyaltyTab) {
    if (tab === shown) return;
    const params = new URLSearchParams(search.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    setClicked(tab);
    startTopProgress();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Loyalty sections"
        className="mb-6 flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
      >
        {LOYALTY_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === shown}
            onClick={() => go(t.id)}
            className={cn(
              "h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
              t.id === shown
                ? "bg-gold text-black shadow-sm"
                : "text-text-subtle hover:bg-surface-hover hover:text-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading && clicked ? <LoyaltyTabSkeleton tab={clicked} /> : children}
    </>
  );
}
