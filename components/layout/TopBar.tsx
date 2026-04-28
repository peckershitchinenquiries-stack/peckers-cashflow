"use client";

import { Logo } from "./Logo";

export function MobileTopBar({ userName }: { userName?: string | null }) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
      <Logo />
      {userName && (
        <div className="text-xs text-text-muted truncate max-w-[55%] text-right">
          {userName}
        </div>
      )}
    </header>
  );
}
