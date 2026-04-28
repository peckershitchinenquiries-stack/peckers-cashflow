"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Pick how the app looks for you on this device.</CardDescription>
      </CardHeader>

      <div className="grid grid-cols-2 gap-3">
        <ThemeOption
          label="Light"
          icon={<SunIcon size={18} />}
          active={mounted && theme === "light"}
          onClick={() => setTheme("light")}
        />
        <ThemeOption
          label="Dark"
          icon={<MoonIcon size={18} />}
          active={mounted && theme === "dark"}
          onClick={() => setTheme("dark")}
        />
      </div>

      <p className="text-xs text-text-muted mt-4">
        Your choice is saved on this device. New devices follow your system theme by default.
      </p>
    </Card>
  );
}

function ThemeOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative h-20 rounded-2xl border flex items-center gap-3 px-4 transition-all",
        "focus:outline-none focus:ring-2 focus:ring-gold/40",
        active
          ? "bg-gold/10 border-gold/50 text-text-primary"
          : "bg-surface border-border hover:bg-surface-hover text-text-subtle",
      )}
    >
      <span
        className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center border",
          active ? "border-gold/40 text-gold bg-gold/10" : "border-border text-text-muted bg-bg",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
      {active && (
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gold" />
      )}
    </button>
  );
}
