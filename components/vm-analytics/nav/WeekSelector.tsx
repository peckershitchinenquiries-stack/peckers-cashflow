"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WeekOption } from "@/lib/vm-analytics/types";
import { weekRange } from "@/lib/vm-analytics/format";

// Global week picker shown in the top bar. Pushes ?week=ISO so every dashboard
// reads the same selected week from searchParams.
//
// The Labor Cost dashboard reads from a different Supabase (cashflow) whose
// available weeks differ from the VM sales weeks, so the layout passes that
// dashboard's weeks separately and we switch on the current route.
export function WeekSelector({
  weeks,
  laborWeeks = [],
}: {
  weeks: WeekOption[];
  laborWeeks?: WeekOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = search.get("week");

  const isLaborCost = pathname.includes("/labor-cost");
  const list = isLaborCost ? laborWeeks : weeks;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(search.toString());
    params.set("week", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (list.length === 0) {
    return (
      <span className="text-sm text-secondary">No weeks synced yet</span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-secondary">Week</span>
      <select
        value={selected ?? list[0].week_start_iso}
        onChange={onChange}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-primary shadow-sm focus:border-brand focus:outline-none"
      >
        {list.map((w) => (
          <option
            key={w.week_start_iso}
            value={w.week_start_iso}
            className="bg-surface text-primary"
          >
            {weekRange(w.week_start, w.week_end)}
          </option>
        ))}
      </select>
    </label>
  );
}
