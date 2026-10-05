"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PerformanceWeekOption } from "@/lib/dashboard/types";

/**
 * Week picker for the performance card. Pushes ?week=, which only this card
 * reads — the payout cards and Needs Action stay on the live week.
 */
export function PerformanceWeekSelector({
  options,
  selected,
}: {
  options: PerformanceWeekOption[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Reflect the pick before the server render of the new week comes back.
  const [pending, startTransition] = React.useTransition();
  const [picked, setPicked] = React.useState<string | null>(null);
  React.useEffect(() => setPicked(null), [selected]);

  return (
    <select
      aria-label="Week shown"
      aria-busy={pending}
      value={pending && picked ? picked : selected}
      onChange={(e) => {
        const params = new URLSearchParams(search.toString());
        params.set("week", e.target.value);
        setPicked(e.target.value);
        startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
      }}
      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs sm:text-sm font-medium text-text-primary focus:border-gold focus:outline-none"
    >
      {options.map((o, i) => (
        <option key={o.iso} value={o.iso}>
          {o.label}
          {i === 0 ? " · last week" : ""}
        </option>
      ))}
    </select>
  );
}
