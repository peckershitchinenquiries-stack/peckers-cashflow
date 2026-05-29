"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_FOR_PORTAL } from "./nav-config";
import type { Portal } from "@/lib/types";

export function BottomNav({ portal }: { portal: Portal }) {
  const pathname = usePathname();
  const items = BOTTOM_NAV_FOR_PORTAL[portal];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-16 text-[11px] transition-colors",
                  active ? "text-text-primary" : "text-text-muted",
                )}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                <span
                  className={cn(
                    "h-1 w-1 rounded-full transition-colors",
                    active ? "bg-gold" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
