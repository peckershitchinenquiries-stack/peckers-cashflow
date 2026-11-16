"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOYALTY_TABS, type LoyaltyTab } from "@/lib/vm-analytics/loyalty-tabs";

// ?tab= on the one route, so the layout's week and store pickers (which keep
// every other parameter) apply to whichever tab is open.
export function LoyaltyTabStrip({ active }: { active: LoyaltyTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Each tab is a server round trip; move the highlight on click, not on arrival.
  const [pending, startTransition] = React.useTransition();
  const [clicked, setClicked] = React.useState<LoyaltyTab | null>(null);
  React.useEffect(() => setClicked(null), [active]);
  const shown = pending && clicked ? clicked : active;

  function go(tab: LoyaltyTab) {
    const params = new URLSearchParams(search.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    setClicked(tab);
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
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
  );
}
