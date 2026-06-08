import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDDMMYYYY, formatGBP, formatTimeOnly, weekLabel, parseISODate } from "@/lib/utils";
import type { PrePaymentSummary } from "@/lib/types";
import type { RunningBalanceRow } from "@/lib/cash-flow";

export type StoreCashView = {
  store: { id: string; name: string };
  openingBalance: number;
  runningBalance: number;
  rows: RunningBalanceRow[];
  discrepancyDays: number;
  summary: PrePaymentSummary;
  lastEntry: { name: string | null; date: string; at: string } | null;
  payoutStatus: "none" | "draft" | "confirmed";
};

function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "gold";
  hint?: string;
}) {
  const toneCls =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-danger"
        : tone === "gold"
          ? "text-gold"
          : "text-text-primary";
  return (
    <div className="rounded-xl bg-bg border border-border px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export function CashFlowDashboard({
  views,
  weekStart,
  basePath,
}: {
  views: StoreCashView[];
  weekStart: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-text-muted -mt-2">
        Week of {weekLabel(parseISODate(weekStart))}
      </p>

      {views.map((v) => {
        const draw = v.summary.post_office_draw;
        return (
          <Card key={v.store.id} className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-text-primary">{v.store.name}</h2>
                {v.payoutStatus === "confirmed" && <Badge variant="success">Wages paid</Badge>}
                {v.payoutStatus === "draft" && <Badge variant="gold">Payout in progress</Badge>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link href={`${basePath}/daily?week=${weekStart}`} className="text-gold hover:underline">
                  Daily entries
                </Link>
                <span className="text-text-muted">·</span>
                <Link href={`${basePath}/payout?week=${weekStart}&store=${v.store.id}`} className="text-gold hover:underline">
                  Saturday payout
                </Link>
                <span className="text-text-muted">·</span>
                <Link href={`${basePath}/history`} className="text-gold hover:underline">
                  History
                </Link>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Post Office draw alert */}
              {draw > 0.001 && (
                <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
                  <p className="text-sm font-semibold text-danger">
                    ⚠ Draw {formatGBP(draw)} from the Post Office before Saturday
                  </p>
                  <p className="text-xs text-text-subtle mt-1">
                    Forecast wages {formatGBP(v.summary.grand_total_wages)} exceed available cash{" "}
                    {formatGBP(v.summary.actual_cash_available)}.
                  </p>
                </div>
              )}

              {/* Stat tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Running cash balance" value={formatGBP(v.runningBalance)} tone="gold" />
                <Stat
                  label="Saturday wage forecast"
                  value={formatGBP(v.summary.grand_total_wages)}
                  hint={`Cash ${formatGBP(v.summary.total_cash_wages)} + delivery ${formatGBP(v.summary.total_delivery_wages)}`}
                />
                <Stat
                  label="Post Office draw"
                  value={formatGBP(draw)}
                  tone={draw > 0.001 ? "bad" : "good"}
                />
                <Stat
                  label="Days with discrepancies"
                  value={String(v.discrepancyDays)}
                  tone={v.discrepancyDays > 0 ? "bad" : "good"}
                />
              </div>

              {/* This week's daily summary */}
              {v.rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-text-muted bg-bg/50">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium text-right">Vita Mojo</th>
                        <th className="px-4 py-2.5 font-medium text-right">Envelope</th>
                        <th className="px-4 py-2.5 font-medium text-right">Diff</th>
                        <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.rows.map((r, i) => {
                        const balanced = Math.abs(r.difference) < 0.001;
                        return (
                          <tr key={r.entry_date} className={`${i % 2 === 0 ? "" : "bg-bg/40"} border-t border-border/60`}>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {formatDDMMYYYY(r.entry_date)}
                              {r.is_late && (
                                <Badge variant="warning" className="ml-2 text-[10px] py-0 px-1.5">Late</Badge>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatGBP(r.vita_mojo_sales)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatGBP(r.envelope_amount)}</td>
                            <td className={`px-4 py-2.5 text-right tabular-nums ${balanced ? "text-text-muted" : r.difference > 0 ? "text-danger" : "text-warning"}`}>
                              {formatGBP(r.difference)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatGBP(r.running_balance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No cash entries recorded this week yet.</p>
              )}

              {/* Last entry */}
              <p className="text-xs text-text-muted">
                {v.lastEntry
                  ? `Last entry: ${formatDDMMYYYY(v.lastEntry.date)} by ${v.lastEntry.name ?? "—"} at ${formatTimeOnly(v.lastEntry.at)}`
                  : "No entries submitted yet."}
                {v.openingBalance > 0 && ` · Opening balance carried forward: ${formatGBP(v.openingBalance)}`}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
