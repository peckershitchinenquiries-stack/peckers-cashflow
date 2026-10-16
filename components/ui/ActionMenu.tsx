"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MoreIcon } from "./icons";
import { BottomSheet, SheetActionList, type SheetAction } from "./BottomSheet";

export type { SheetAction };

/**
 * Three-dot button that opens the secondary actions as a bottom sheet.
 * Phone only by default — pair it with the desktop buttons wrapped in
 * `hidden md:flex` so the desktop layout is unchanged.
 */
export function ActionMenu({
  actions,
  title,
  label = "More actions",
  className,
  desktop = false,
  children,
}: {
  actions: SheetAction[];
  title?: React.ReactNode;
  label?: string;
  className?: string;
  /** Also show on md+ (default: phone only). */
  desktop?: boolean;
  /** Custom trigger content (defaults to a three-dot icon button). */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  if (actions.every((a) => a.hidden)) return null;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "h-10 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-text-primary text-sm font-medium",
          "active:bg-surface-hover transition-colors",
          children ? "px-3" : "w-10",
          !desktop && "md:hidden",
          className,
        )}
      >
        {children ?? <MoreIcon size={20} />}
      </button>
      <BottomSheet open={open} onClose={close} title={title}>
        <SheetActionList actions={actions} onDone={close} />
      </BottomSheet>
    </>
  );
}
