import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "success" | "danger" | "warning" | "gold";

const variants: Record<Variant, string> = {
  neutral: "bg-surface-hover text-text-subtle border-border",
  success: "bg-success/10 text-success border-success/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  gold: "bg-gold/10 text-gold border-gold/30",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
