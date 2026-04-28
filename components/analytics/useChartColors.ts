"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export function useChartColors() {
  const { theme } = useTheme();
  if (theme === "light") {
    return {
      gold: "#b88620",       // deeper amber for visibility on white
      danger: "#da4646",
      warning: "#c89119",
      muted: "#6e6e6e",
      cursorFill: "rgba(0,0,0,0.04)",
      cursorStroke: "#d4d2cc",
    };
  }
  return {
    gold: "#e8d5a3",
    danger: "#f87171",
    warning: "#fbbf24",
    muted: "#888888",
    cursorFill: "rgba(255,255,255,0.04)",
    cursorStroke: "#3a3a3a",
  };
}
