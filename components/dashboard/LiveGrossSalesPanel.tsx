"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { shortStore } from "@/lib/vm-analytics/constants";
import { cn, formatGBP } from "@/lib/utils";
import type { LiveGrossSalesResponse, LiveSalesStoreRow } from "@/lib/live-sales/types";

// Upstream data only moves every ~30 min (VM Hub lags 15–30), so polling faster
// would just re-read the same figures.
const REFRESH_MS = 30 * 60 * 1000;
const TICK_MS = 60 * 1000;

function londonHHMM(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const aovText = (v: number | null) => (v == null ? "—" : formatGBP(v));

function Tile({
  label,
  value,
  rows,
  render,
  gold,
}: {
  label: string;
  value: string;
  rows: LiveSalesStoreRow[];
  render: (row: LiveSalesStoreRow) => string;
  gold?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-hover/40 p-3 sm:p-4 min-w-0">
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.18em] text-text-muted font-medium leading-snug">
        {label}
      </p>
      <p
        className={cn(
          "text-lg sm:text-2xl font-semibold mt-1.5 truncate tabular-nums",
          gold ? "text-gold" : "text-text-primary",
        )}
      >
        {value}
      </p>
      {rows.length > 0 && (
        <dl className="mt-2.5 pt-2.5 border-t border-border space-y-1">
          {rows.map((row) => (
            <div key={row.store} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="text-text-muted truncate">{shortStore(row.store)}</dt>
              <dd className="text-text-primary tabular-nums font-medium">{render(row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function LiveGrossSalesPanel() {
  const [data, setData] = React.useState<LiveGrossSalesResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const lastFetchRef = React.useRef(0);
  const inFlightRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const res = await fetch("/api/live-sales", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as LiveGrossSalesResponse);
      setFailed(false);
    } catch {
      // Keep the last good figures on screen; only flag that they aren't fresh.
      setFailed(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    // Ticks are skipped while the tab is hidden; returning to it refetches if due.
    const refreshIfDue = () => {
      if (document.hidden) return;
      if (Date.now() - lastFetchRef.current >= REFRESH_MS) load();
    };
    const timer = window.setInterval(refreshIfDue, TICK_MS);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfDue);
    };
  }, [load]);

  const stores = React.useMemo(
    () =>
      [...(data?.byStore ?? [])].sort((a, b) =>
        shortStore(a.store).localeCompare(shortStore(b.store)),
      ),
    [data],
  );

  const firstLoad = loading && !data;
  const noSales = !!data && data.totals.grossSales === 0;

  return (
    <Card className="max-sm:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-wide text-text-primary">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full flex-shrink-0",
                failed ? "bg-warning" : "bg-success animate-pulse",
              )}
            />
            Live gross sales · today
          </h3>
          <p className="text-xs text-text-muted mt-1">
            {data ? `Updated ${londonHHMM(data.asOf)} ` : ""}(VM data lags 15–30 min)
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 h-9 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {failed && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm">
          <span className="text-danger font-medium">
            Live data unavailable
            {data && (
              <span className="font-normal text-text-subtle">
                {" "}— showing figures from {londonHHMM(data.asOf)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-sm font-medium text-danger underline underline-offset-2 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {data?.stale && !failed && (
        <p className="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Showing last available data from {londonHHMM(data.asOf)}
        </p>
      )}

      {firstLoad ? (
        <div className="animate-pulse" aria-label="Loading live sales">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-surface-hover" />
            ))}
          </div>
        </div>
      ) : !data ? null : noSales ? (
        <p className="py-6 text-center text-sm text-text-muted">No sales yet today</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Tile
            label="Gross Sales"
            value={formatGBP(data.totals.grossSales)}
            rows={stores}
            render={(r) => formatGBP(r.grossSales)}
            gold
          />
          <Tile
            label="Orders"
            value={data.totals.orders.toLocaleString("en-GB")}
            rows={stores}
            render={(r) => r.orders.toLocaleString("en-GB")}
          />
          <Tile
            label="AOV"
            value={aovText(data.totals.aov)}
            rows={stores}
            render={(r) => aovText(r.aov)}
          />
        </div>
      )}
    </Card>
  );
}
