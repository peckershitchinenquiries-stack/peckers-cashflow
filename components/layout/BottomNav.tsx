"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AlertIcon,
  ClockIcon,
  GridIcon,
  HomeIcon,
  RadioIcon,
} from "@/components/ui/icons";

const items = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/live", label: "Live", icon: RadioIcon },
  { href: "/rota", label: "Rota", icon: GridIcon },
  { href: "/crew", label: "Crew", icon: ClockIcon },
  { href: "/alerts", label: "Alerts", icon: AlertIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
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
