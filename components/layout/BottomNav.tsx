"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChartIcon,
  HomeIcon,
  ListIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons";

const items = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/employees", label: "Staff", icon: UsersIcon },
  { href: "/entries", label: "Entries", icon: ListIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
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
