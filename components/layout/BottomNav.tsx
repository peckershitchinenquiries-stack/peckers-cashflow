"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { NavLink } from "./NavLink";
import { BOTTOM_NAV_FOR_PORTAL, NAV_FOR_PORTAL } from "./nav-config";
import { MoreIcon } from "@/components/ui/icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Portal } from "@/lib/types";

function isActive(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(href + "/");
}

export function BottomNav({ portal }: { portal: Portal }) {
  const pathname = usePathname();
  const fullNav = NAV_FOR_PORTAL[portal];
  const primary = BOTTOM_NAV_FOR_PORTAL[portal];
  // Only add a "More" tab when the full menu doesn't already fit in the bar.
  // Settings alone doesn't earn one: it is also in the top bar's account sheet.
  const needsMore = fullNav.some(
    (i) => !primary.includes(i) && !i.href.endsWith("/settings"),
  );

  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Close the sheet whenever navigation happens (route changes).
  React.useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const columns = primary.length + (needsMore ? 1 : 0);
  // A page is "in the More sheet" (not a primary tab) — used to light up the
  // More tab when you're on one of those pages.
  const primaryHrefs = new Set(primary.map((i) => i.href));
  const moreActive =
    needsMore && !primaryHrefs.has(pathname ?? "") &&
    fullNav.some((i) => !primaryHrefs.has(i.href) && isActive(pathname, i.href));

  return (
    <>
      <nav
        className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-border/70"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className="block">
                <TabFace
                  icon={item.icon}
                  label={item.shortLabel ?? item.label}
                  active={!!isActive(pathname, item.href)}
                />
              </NavLink>
            </li>
          ))}

          {needsMore && (
            <li>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="More pages"
                aria-expanded={sheetOpen}
                className="w-full block"
              >
                <TabFace icon={MoreIcon} label="More" active={moreActive || sheetOpen} />
              </button>
            </li>
          )}
        </ul>
      </nav>

      {needsMore && (
        <MoreSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          items={fullNav.filter((i) => !primaryHrefs.has(i.href))}
          pathname={pathname}
        />
      )}
    </>
  );
}

function TabFace({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium select-none transition-colors active:opacity-70",
        active ? "text-text-primary" : "text-text-muted",
      )}
    >
      <span
        className={cn(
          "h-8 w-14 rounded-full flex items-center justify-center transition-colors duration-200",
          active ? "bg-gold/20 text-gold" : "bg-transparent",
        )}
      >
        <Icon size={21} />
      </span>
      <span className="max-w-full truncate px-0.5 leading-none">{label}</span>
    </span>
  );
}

function MoreSheet({
  open,
  onClose,
  items,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; group?: string }[];
  pathname: string | null;
}) {
  const groups: { name: string; items: typeof items }[] = [];
  for (const item of items) {
    const name = item.group ?? "General";
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(item);
    else groups.push({ name, items: [item] });
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      <nav className="flex flex-col gap-4 px-1 pb-1">
        {groups.map((g) => (
          <section key={g.name}>
            <p className="px-1 mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
              {g.name}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-2xl border px-1 py-3 min-h-[84px] text-center transition-colors active:scale-[.97]",
                      active
                        ? "border-gold/50 bg-gold/10 text-text-primary"
                        : "border-border bg-bg/60 text-text-subtle",
                    )}
                  >
                    <span
                      className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center",
                        active ? "bg-gold text-black" : "bg-surface-hover text-text-primary",
                      )}
                    >
                      <Icon size={19} />
                    </span>
                    <span className="text-[12px] font-medium leading-tight line-clamp-2">
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </BottomSheet>
  );
}
