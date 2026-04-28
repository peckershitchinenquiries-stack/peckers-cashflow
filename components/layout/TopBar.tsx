"use client";

import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function MobileTopBar({ userName }: { userName?: string | null }) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
      <Logo />
      <div className="flex items-center gap-2 min-w-0">
        {userName && (
          <span className="text-xs text-text-muted truncate max-w-[140px] text-right">
            {userName}
          </span>
        )}
        <ThemeToggle variant="icon" className="h-9 w-9" />
      </div>
    </header>
  );
}
