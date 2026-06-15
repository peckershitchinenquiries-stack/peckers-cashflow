"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DASHBOARDS } from "@/lib/vm-analytics/constants";

// The "VM Analytics" module: a dropdown that lets you pick which dashboard to
// view. Keeps the currently-selected week in the URL when switching dashboards.
export function DashboardSelector() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const week = search.get("week");
  const qs = week ? `?week=${week}` : "";
  const active = DASHBOARDS.find((d) => pathname.startsWith(d.href));

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-left shadow-sm transition hover:border-brand"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-xs font-bold text-white">
            VM
          </span>
          <span>
            <span className="block text-xs font-medium text-secondary">
              VM Analytics
            </span>
            <span className="block text-sm font-semibold text-primary">
              {active ? active.title : "Select a dashboard"}
            </span>
          </span>
        </span>
        <svg
          className={`h-4 w-4 text-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {DASHBOARDS.map((d) => {
            const isActive = active?.key === d.key;
            return (
              <Link
                key={d.key}
                href={`${d.href}${qs}`}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 transition hover:bg-surface-hover ${
                  isActive ? "bg-surface-hover" : ""
                }`}
              >
                <span className="block text-sm font-medium text-primary">
                  {d.title}
                </span>
                <span className="block text-xs text-secondary">{d.blurb}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
