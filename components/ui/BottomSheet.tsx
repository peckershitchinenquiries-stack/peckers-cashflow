"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Phone-style sheet that slides up from the bottom; swipe the handle down to dismiss. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const startY = React.useRef<number | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    setDragY(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-[visibility] duration-200",
        open ? "visible" : "invisible",
      )}
      aria-hidden={!open}
      // A portal still bubbles React events to its owner; a tap in the sheet
      // must not also reach a clickable card the trigger sits inside.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-surface rounded-t-3xl shadow-2xl",
          "max-h-[85dvh] flex flex-col",
          startY.current == null && "transition-transform duration-200 ease-out",
          className,
        )}
        style={{
          transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          className="pt-2.5 pb-1 touch-none cursor-grab"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (startY.current == null) return;
            setDragY(Math.max(0, e.clientY - startY.current));
          }}
          onPointerUp={() => {
            const dismissed = dragY > 80;
            startY.current = null;
            setDragY(0);
            if (dismissed) onClose();
          }}
          onPointerCancel={() => {
            startY.current = null;
            setDragY(0);
          }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border-strong" />
        </div>
        {title != null && (
          <div className="px-5 pt-1 pb-2 text-sm font-semibold text-text-primary truncate">
            {title}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-3 pb-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export type SheetAction = {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  description?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Leave out of the list entirely (e.g. role-gated). */
  hidden?: boolean;
};

/** A tappable list of actions for use inside a BottomSheet. */
export function SheetActionList({
  actions,
  onDone,
}: {
  actions: SheetAction[];
  onDone: () => void;
}) {
  const visible = actions.filter((a) => !a.hidden);
  return (
    <ul className="rounded-2xl bg-bg/60 border border-border divide-y divide-border overflow-hidden">
      {visible.map((a) => (
        <li key={a.label}>
          <button
            type="button"
            disabled={a.disabled}
            onClick={() => {
              onDone();
              a.onSelect();
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 min-h-[52px] py-2 text-left text-[15px] transition-colors",
              "active:bg-surface-hover disabled:opacity-40",
              a.tone === "danger" ? "text-danger" : "text-text-primary",
            )}
          >
            {a.icon && (
              <span className={cn("shrink-0", a.tone === "danger" ? "text-danger" : "text-text-muted")}>
                {a.icon}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{a.label}</span>
              {a.description && (
                <span className="block text-xs text-text-muted mt-0.5">{a.description}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** True below the md breakpoint, where pickers open as sheets instead of dropdowns. */
export function useIsPhone() {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}
