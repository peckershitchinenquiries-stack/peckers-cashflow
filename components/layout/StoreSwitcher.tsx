"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { switchStore } from "@/app/actions/store-switch";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CheckIcon } from "@/components/ui/icons";

export type StoreOption = { id: string; name: string };

/**
 * Lets a manager switch the store the WHOLE app operates as. Changing the
 * selection calls switchStore(), which persists the choice on their account and
 * revalidates every page — so after the refresh the app shows the chosen
 * store's data with full manager access. A "Covering" tag shows when they're on
 * a store other than their home one.
 */
export function StoreSwitcher({
  stores,
  activeStoreId,
  homeStoreId,
  compact = false,
  className,
}: {
  stores: StoreOption[];
  activeStoreId: string | null;
  homeStoreId: string | null;
  /** Tighter styling for the mobile top bar. */
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing to switch between.
  if (stores.length < 2) return null;

  const current = activeStoreId ?? homeStoreId ?? "";
  const covering = homeStoreId != null && current !== "" && current !== homeStoreId;
  const currentStore = stores.find((s) => s.id === current);

  async function pick(id: string) {
    setOpen(false);
    if (id === current) return;
    setBusy(true);
    try {
      const res = await switchStore(id || null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const picked = stores.find((s) => s.id === id);
      toast.success(picked ? `Switched to ${picked.name}` : "Store switched");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch store.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)} ref={rootRef}>
      {!compact && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Store</span>
          {covering && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
              Covering
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-lg border bg-surface text-text-primary",
            "text-left focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-60 transition-colors",
            "hover:bg-surface/70",
            covering ? "border-gold/50" : "border-border",
            compact ? "h-9 px-2 text-xs max-w-[150px]" : "h-10 px-3 text-sm",
          )}
        >
          <span className="truncate">
            {currentStore?.name ?? "Select store"}
            {currentStore && homeStoreId === currentStore.id ? " (home)" : ""}
          </span>
          <ChevronDownIcon
            size={compact ? 14 : 16}
            className={cn("shrink-0 text-text-muted transition-transform", open && "rotate-180")}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className={cn(
              "absolute z-50 mt-1 w-full min-w-[180px] overflow-hidden rounded-lg border border-border",
              "bg-bg shadow-lg py-1",
            )}
          >
            {stores.map((s) => {
              const selected = s.id === current;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(s.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors",
                      selected
                        ? "bg-gold/10 text-gold"
                        : "text-text-primary hover:bg-surface",
                    )}
                  >
                    <span className="truncate">
                      {s.name}
                      {homeStoreId === s.id ? " (home)" : ""}
                    </span>
                    {selected && <CheckIcon size={14} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
