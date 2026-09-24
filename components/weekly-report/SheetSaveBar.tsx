"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";

/**
 * One Save for the whole sheet.
 *
 * The grids used to write a row the moment a cell lost focus, which on a
 * fifteen-supplier Cost of Goods sheet is fifteen server actions and fifteen
 * full-page revalidates typed into — the lag between rows managers complained
 * about. Everything is now held as drafts and sent in ONE call, so the cost of
 * entering a sheet no longer grows with the number of rows in it.
 */
export function useUnsavedGuard(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // Tab strips and the week picker are client-side links, so a reload guard
    // alone would let unsaved rows vanish on a single click.
    const intercept = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!link) return;
      if (window.confirm("This sheet has unsaved changes. Leave without saving?")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);
}

export function SheetSaveBar({
  dirty,
  count,
  busy,
  onSave,
  onDiscard,
  children,
}: {
  dirty: boolean;
  /** How many rows are waiting — the reassurance that nothing was dropped. */
  count: number;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  children?: React.ReactNode;
}) {
  useUnsavedGuard(dirty);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
      {children}
      <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:ml-0 max-sm:w-full">
        <span
          className={
            dirty
              ? "text-xs font-medium text-amber-600 dark:text-amber-400"
              : "text-xs text-text-muted"
          }
        >
          {dirty
            ? `${count} unsaved ${count === 1 ? "change" : "changes"}`
            : "All changes saved"}
        </span>
        {dirty && (
          <Button size="sm" variant="ghost" onClick={onDiscard} disabled={busy}>
            Discard
          </Button>
        )}
        <Button size="sm" onClick={onSave} loading={busy} disabled={!dirty}>
          Save
        </Button>
      </div>
    </div>
  );
}
