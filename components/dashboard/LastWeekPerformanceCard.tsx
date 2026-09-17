import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn, formatGBP } from "@/lib/utils";
import { signedPct } from "@/lib/vm-analytics/format";
import type { LastWeekPerformance } from "@/lib/dashboard/types";
import { ChangeBadge } from "./ChangeBadge";
import { ddmm, fractionPct } from "./format";

function StatusBadge({ status }: { status: LastWeekPerformance["status"] }) {
  if (status === "sent") return <Badge variant="success">Sent ✓</Badge>;
  if (status === "locked") return <Badge variant="success">Locked ✓</Badge>;
  if (status === "draft") return <Badge variant="warning">Draft</Badge>;
  return <Badge>No report</Badge>;
}

function Tile({
  label,
  value,
  tone,
  className,
  children,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success" | "gold";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface-hover/40 p-3 sm:p-4 min-w-0", className)}>
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.18em] text-text-muted font-medium leading-snug">
        {label}
      </p>
      <p
        className={cn(
          "text-xl sm:text-2xl font-semibold mt-1.5 tabular-nums break-words",
          tone === "danger"
            ? "text-danger"
            : tone === "success"
              ? "text-success"
              : tone === "gold"
                ? "text-gold"
                : "text-text-primary",
        )}
      >
        {value}
      </p>
      {children && (
        <div className="mt-2 space-y-1.5 text-[11px] sm:text-xs text-text-muted break-words">{children}</div>
      )}
    </div>
  );
}

const moneyTone = (v: number) => (v < 0 ? "danger" : undefined);

export function LastWeekPerformanceCard({ data }: { data: LastWeekPerformance }) {
  const synced = data.grossSales > 0;
  const { pnl } = data;
  const budgetSet = !!pnl && pnl.labourBudgetPct > 0;
  const overBudget = budgetSet && pnl.labourVariancePct < 0;

  const unavailable = (
    <p>{pnl ? "Sales not synced yet" : "Weekly report not started"}</p>
  );

  return (
    <Card className="max-sm:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-wide text-text-primary">
            Last week · {ddmm(data.weekStart)} – {ddmm(data.weekEnd)}
            <StatusBadge status={data.status} />
          </h3>
          {data.status === "draft" && (
            <p className="text-xs text-warning mt-1">Provisional (report not locked)</p>
          )}
        </div>
        <a
          href={data.reportHref}
          className="text-sm font-medium text-gold hover:underline underline-offset-2 max-sm:hidden"
        >
          Open weekly report →
        </a>
      </div>

      {data.loadError && (
        <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Couldn&apos;t load part of the weekly report ({data.loadError}). Costs below may be
          incomplete.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Tile
          label="Gross Sales"
          value={synced ? formatGBP(data.grossSales) : "—"}
          tone="gold"
          className="col-span-2 lg:col-span-1"
        >
          {synced ? (
            <>
              <ChangeBadge pct={data.wowPct} label="vs prev week" />
              <p className="tabular-nums">
                Net {formatGBP(data.netSales)}
                {data.hasYoyRow ? (
                  data.yoyNetPct !== null && (
                    <span className={data.yoyNetPct >= 0 ? "text-success" : "text-danger"}>
                      {" "}· {data.yoyNetPct >= 0 ? "▲" : "▼"}
                      {signedPct(Math.abs(data.yoyNetPct)).replace("+", "")} net sales vs last year
                    </span>
                  )
                ) : (
                  <span> · No data last year</span>
                )}
              </p>
            </>
          ) : (
            <p>Sales not synced yet</p>
          )}
        </Tile>

        <Tile
          label="Labour %"
          className="col-span-2 lg:col-span-1"
          value={pnl && synced ? fractionPct(pnl.labourPct) : "—"}
          tone={pnl && synced && budgetSet ? (overBudget ? "danger" : "success") : undefined}
        >
          {pnl && synced ? (
            <>
              <p className="tabular-nums">
                {budgetSet ? `Budget ${fractionPct(pnl.labourBudgetPct)} · ` : ""}
                {formatGBP(pnl.labour)}
              </p>
              {budgetSet && (
                <p className={cn("tabular-nums", overBudget ? "text-danger" : "text-success")}>
                  {overBudget ? "+" : "−"}
                  {Math.abs(pnl.labourVariancePct * 100).toFixed(1)} pts vs budget
                </p>
              )}
            </>
          ) : (
            unavailable
          )}
        </Tile>

        <Tile
          label="Store Contribution"
          value={pnl && synced ? formatGBP(pnl.storeContribution) : "—"}
          tone={pnl && synced ? moneyTone(pnl.storeContribution) : undefined}
        >
          {pnl && synced ? (
            <p className="tabular-nums">{fractionPct(pnl.storeContributionPct)} of net sales</p>
          ) : (
            unavailable
          )}
        </Tile>

        <Tile
          label="Net Margin"
          value={pnl && synced ? formatGBP(pnl.netMargin) : "—"}
          tone={pnl && synced ? moneyTone(pnl.netMargin) : undefined}
        >
          {pnl && synced ? (
            <p className="tabular-nums">{fractionPct(pnl.netMarginPct)} of gross sales</p>
          ) : (
            unavailable
          )}
        </Tile>
      </div>

      <a
        href={data.reportHref}
        className="sm:hidden mt-3 block text-sm font-medium text-gold"
      >
        Open weekly report →
      </a>
    </Card>
  );
}
