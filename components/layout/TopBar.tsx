"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { StoreSwitcher, type StoreOption } from "./StoreSwitcher";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LogoutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "@/components/ui/icons";
import { signOutAction } from "@/app/actions/auth";
import { NAV_FOR_PORTAL } from "./nav-config";
import { PullToRefresh } from "./PullToRefresh";
import type { Portal } from "@/lib/types";

const PORTAL_TAG: Record<Portal, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Crew",
  cover_driver: "Cover driver",
};

// Screens reached from inside another screen rather than from the menu.
const EXTRA_TITLES: { href: string; title: string; parent?: string }[] = [
  { href: "/vm-analytics", title: "VM Analytics" },
  { href: "/entries", title: "Entries" },
  { href: "/cash-flow/daily", title: "Daily Cash", parent: "/cash-flow" },
  { href: "/manager/cash-flow/daily", title: "Daily Cash", parent: "/manager/cash-flow" },
  { href: "/manager/entries", title: "Cash Entries", parent: "/manager/cash-flow" },
];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Title for the current screen, and where "back" goes when it isn't a menu page. */
function resolveScreen(portal: Portal, pathname: string) {
  const nav = NAV_FOR_PORTAL[portal];
  const exact = nav.find((i) => i.href === pathname);
  if (exact) return { title: exact.label, parent: null as string | null };
  const extra = [...EXTRA_TITLES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((e) => matches(pathname, e.href));
  if (extra) return { title: extra.title, parent: extra.parent ?? null };
  const prefix = [...nav]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => matches(pathname, i.href));
  if (prefix) return { title: prefix.label, parent: null };
  return { title: null, parent: null };
}

function initialsOf(name?: string | null) {
  return (name ?? "")
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MobileTopBar({
  portal,
  userName,
  stores,
  activeStoreId = null,
  homeStoreId = null,
}: {
  portal: Portal;
  userName?: string | null;
  /** Manager multi-store switcher — omit to hide it. */
  stores?: StoreOption[];
  activeStoreId?: string | null;
  homeStoreId?: string | null;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [accountOpen, setAccountOpen] = React.useState(false);
  const closeAccount = React.useCallback(() => setAccountOpen(false), []);
  const showSwitcher = stores != null && stores.length > 1;
  const { title, parent } = resolveScreen(portal, pathname);
  const settingsHref = NAV_FOR_PORTAL[portal].find((i) => i.href.endsWith("/settings"))?.href;

  React.useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  return (
    <>
    <PullToRefresh />
    <header className="md:hidden print:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur-xl border-b border-border/70 pt-[env(safe-area-inset-top)]">
      <div className="h-14 flex items-center gap-1 px-2">
        {parent ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(parent))}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-text-primary active:bg-surface-hover"
          >
            <ChevronLeftIcon size={22} />
          </button>
        ) : (
          <span className="w-2 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          {title ? (
            <h1 className="text-[17px] font-semibold tracking-tight text-text-primary truncate">
              {title}
            </h1>
          ) : (
            <Logo />
          )}
        </div>
        {showSwitcher && (
          <StoreSwitcher
            stores={stores!}
            activeStoreId={activeStoreId}
            homeStoreId={homeStoreId}
            compact
          />
        )}
        <button
          type="button"
          aria-label="Account"
          onClick={() => setAccountOpen(true)}
          className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full active:bg-surface-hover"
        >
          <span className="h-8 w-8 rounded-full bg-gold/15 text-gold border border-gold/30 flex items-center justify-center text-[11px] font-semibold">
            {initialsOf(userName) || "•"}
          </span>
        </button>
      </div>

      <BottomSheet open={accountOpen} onClose={closeAccount}>
        <AccountSheetBody
          portal={portal}
          userName={userName}
          settingsHref={settingsHref}
          onNavigate={closeAccount}
        />
      </BottomSheet>
    </header>
    </>
  );
}

function AccountSheetBody({
  portal,
  userName,
  settingsHref,
  onNavigate,
}: {
  portal: Portal;
  userName?: string | null;
  settingsHref?: string;
  onNavigate: () => void;
}) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const row =
    "w-full flex items-center gap-3 px-4 min-h-[52px] text-left text-[15px] active:bg-surface-hover";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className="h-12 w-12 shrink-0 rounded-full bg-gold/15 text-gold border border-gold/30 flex items-center justify-center text-sm font-semibold">
          {initialsOf(userName) || "•"}
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-primary truncate">{userName}</p>
          <p className="text-xs text-text-muted">{PORTAL_TAG[portal]}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-bg/60 border border-border divide-y divide-border overflow-hidden">
        <button type="button" onClick={toggle} className={row + " text-text-primary"}>
          <span className="text-text-muted">{isDark ? <MoonIcon size={18} /> : <SunIcon size={18} />}</span>
          <span className="flex-1 font-medium">Dark mode</span>
          <span
            role="switch"
            aria-checked={isDark}
            className={
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors " +
              (isDark ? "bg-gold" : "bg-border-strong")
            }
          >
            <span
              className={
                "h-5 w-5 rounded-full bg-white shadow transition-transform " +
                (isDark ? "translate-x-6" : "translate-x-1")
              }
            />
          </span>
        </button>
        {settingsHref && (
          <Link href={settingsHref} onClick={onNavigate} className={row + " text-text-primary"}>
            <span className="text-text-muted"><SettingsIcon size={18} /></span>
            <span className="flex-1 font-medium">Settings</span>
            <ChevronRightIcon size={16} className="text-text-muted" />
          </Link>
        )}
      </div>

      <form action={signOutAction} className="rounded-2xl bg-bg/60 border border-border overflow-hidden">
        <input type="hidden" name="portal" value={portal} />
        <button type="submit" className={row + " text-danger"}>
          <LogoutIcon size={18} />
          <span className="flex-1 font-medium">Sign out</span>
        </button>
      </form>
    </div>
  );
}
