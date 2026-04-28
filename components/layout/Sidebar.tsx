"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import {
  ChartIcon,
  HomeIcon,
  ListIcon,
  SettingsIcon,
  UsersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/employees", label: "Employees", icon: UsersIcon },
  { href: "/entries", label: "Entries", icon: ListIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-bg sticky top-0 h-screen transition-all duration-200",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      <div
        className={cn(
          "flex items-center h-16 px-3 border-b border-border",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <Logo compact={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface",
            collapsed && "absolute right-2",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 h-11 px-3 rounded-xl text-sm transition-colors",
                active
                  ? "bg-surface text-text-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-surface/60",
                collapsed && "justify-center px-0",
              )}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gold" />
              )}
              <Icon size={collapsed ? 20 : 18} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "p-3 border-t border-border text-text-muted",
          collapsed ? "text-center" : "",
        )}
      >
        <p className="text-[10px] uppercase tracking-[0.2em]">v1.0</p>
      </div>
    </aside>
  );
}
