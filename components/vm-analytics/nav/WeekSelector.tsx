"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WeekOption } from "@/lib/vm-analytics/types";
import { weekRange } from "@/lib/vm-analytics/format";

// Global week picker shown in the top bar. Pushes ?week=ISO so every dashboard
// reads the same selected week from searchParams.
export function WeekSelector({ weeks }: { weeks: WeekOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = search.get("week");

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(search.toString());
    params.set("week", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (weeks.length === 0) {
    return (
      <span className="text-sm text-ink-faint">No weeks synced yet</span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-faint">Week</span>
      <select
        value={selected ?? weeks[0].week_start_iso}
        onChange={onChange}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm focus:border-brand focus:outline-none"
      >
        {weeks.map((w) => (
          <option key={w.week_start_iso} value={w.week_start_iso}>
            {weekRange(w.week_start, w.week_end)}
          </option>
        ))}
      </select>
    </label>
  );
}
