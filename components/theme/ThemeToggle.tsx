"use client";

import * as React from "react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

type Variant = "icon" | "switch" | "labeled";

export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Until mounted, render a placeholder of the same size to avoid hydration mismatch.
  if (!mounted) {
    if (variant === "switch") return <span className={cn("inline-block h-7 w-12 rounded-full bg-surface-hover", className)} />;
    if (variant === "labeled")
      return <span className={cn("inline-flex h-10 w-[120px] rounded-xl bg-surface-hover", className)} />;
    return <span className={cn("inline-block h-10 w-10 rounded-xl bg-surface-hover", className)} />;
  }

  const isDark = theme === "dark";

  if (variant === "switch") {
    return (
      <button
        type="button"
        onClick={toggle}
        role="switch"
        aria-checked={isDark}
        aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full border border-border transition-colors",
          isDark ? "bg-surface" : "bg-gold/20",
          className,
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-black transition-transform shadow",
            isDark ? "translate-x-6" : "translate-x-1",
          )}
        >
          {isDark ? <MoonIcon size={12} /> : <SunIcon size={12} />}
        </span>
      </button>
    );
  }

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        className={cn(
          "btn-base h-10 px-4 bg-surface text-text-primary border border-border hover:bg-surface-hover focus:ring-2 focus:ring-gold/30",
          className,
        )}
      >
        {isDark ? <MoonIcon size={16} /> : <SunIcon size={16} />}
        <span className="text-sm">{isDark ? "Dark" : "Light"} mode</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={cn(
        "h-10 w-10 inline-flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-gold/30",
        className,
      )}
    >
      {isDark ? <MoonIcon size={18} /> : <SunIcon size={18} />}
    </button>
  );
}
