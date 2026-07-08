"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STORES, shortStore } from "@/lib/vm-analytics/constants";

// Store filter shown in the top bar, to the left of the week picker. Pushes
// ?store=<short name> so a dashboard can scope to one store. Empty = both
// stores combined (the default).
export function StoreSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = search.get("store") ?? "";

  // Store Comparison is always both stores side by side, so a store filter makes
  // no sense there — hide the selector on that dashboard.
  if (pathname?.includes("/store-comparison")) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(search.toString());
    if (e.target.value) params.set("store", e.target.value);
    else params.delete("store");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none">
      <span className="text-secondary">Store</span>
      <select
        value={selected}
        onChange={onChange}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-primary shadow-sm focus:border-gold focus:outline-none sm:flex-none"
      >
        <option value="" className="bg-surface text-primary">
          All Stores
        </option>
        {STORES.map((s) => (
          <option key={s} value={shortStore(s)} className="bg-surface text-primary">
            {shortStore(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
