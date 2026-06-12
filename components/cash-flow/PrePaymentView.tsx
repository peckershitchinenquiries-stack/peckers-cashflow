"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@/components/ui/icons";
import {
  generatePayout,
  markLinePaid,
  confirmPayout,
  unlockPayout,
} from "@/app/actions/payouts";
import { formatGBP, formatDDMMYYYY, weekLabel, parseISODate, formatTimeOnly } from "@/lib/utils";
import type { CashPayoutWithLines, PrePaymentSummary } from "@/lib/types";

type StoreOpt = { id: string; name: string };
type DisplayLine = {
  employee_name: string;
  role: string | null;
  cash_hours: number;
  cash_rate: number;
  deliveries_count: number;
  delivery_wages: number;
  total_payment: number;
  id?: string;
  is_paid?: boolean;
};

export function PrePaymentView({
  summary,
  payout,
  store,
  stores,
  weekStart,
  prevWeek,
  nextWeek,
  isAdmin,
  basePath,
}: {
  summary: PrePaymentSummary;
  payout: CashPayoutWithLines | null;
  store: StoreOpt;
  stores: StoreOpt[];
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  isAdmin: boolean;
  basePath: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const locked = payout?.locked ?? false;
  const confirmed = payout?.status === "confirmed";

  // Financial figures: use the locked snapshot once confirmed, else the live forecast.
  const fin = confirmed && payout
    ? {
        opening_balance: payout.opening_balance,
        vita_mojo_total: payout.cash_collected + payout.logged_differences,
        cash_collected: payout.cash_collected,
        logged_differences: payout.logged_differences,
        actual_cash_available: payout.actual_cash_available,
        total_cash_wages: payout.total_cash_wages,
        total_delivery_wages: payout.total_delivery_wages,
        grand_total_wages: payout.grand_total_wages,
        post_office_draw: payout.post_office_draw,
        surplus: payout.surplus_carry_forward,
      }
    : summary;

  const lines: DisplayLine[] = payout ? payout.lines : summary.lines;
  const paidCount = payout ? payout.lines.filter((l) => l.is_paid).length : 0;

  function go(storeId: string, week: string) {
    return `${basePath}/payout?week=${week}&store=${storeId}`;
  }

  async function doGenerate() {
    setBusy("generate");
    try {
      await generatePayout({ store_id: store.id, week_start: weekStart });
      toast.success(payout ? "Payout sheet refreshed" : "Payout sheet generated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function togglePaid(lineId: string, paid: boolean) {
    setBusy(lineId);
    try {
      await markLinePaid({ line_id: lineId, paid });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function doConfirm() {
    if (!payout) return;
    setBusy("confirm");
    try {
      await confirmPayout({ payout_id: payout.id });
      toast.success("Wages confirmed and locked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function doUnlock() {
    if (!payout) return;
    if (!confirm("Unlock this confirmed payout for amendment?")) return;
    setBusy("unlock");
    try {
      await unlockPayout({ payout_id: payout.id });
      toast.success("Payout unlocked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const saturday = formatDDMMYYYY(
    new Date(parseISODate(weekStart).getTime() + 5 * 86400000),
  );
  // Wages paid this Saturday are for the PREVIOUS Mon–Sun week.
  const payWeekStartDate = new Date(parseISODate(weekStart).getTime() - 7 * 86400000);
  const payWeekLabel = `${formatDDMMYYYY(payWeekStartDate)} – ${formatDDMMYYYY(
    new Date(payWeekStartDate.getTime() + 6 * 86400000),
  )}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Week nav + store selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={go(store.id, prevWeek)}>
            <Button variant="secondary" size="icon" aria-label="Previous week">
              <ChevronLeftIcon size={16} />
            </Button>
          </Link>
          <span className="text-sm font-medium text-text-primary min-w-[180px] text-center">
            {weekLabel(parseISODate(weekStart))}
          </span>
          <Link href={go(store.id, nextWeek)}>
            <Button variant="secondary" size="icon" aria-label="Next week">
              <ChevronRightIcon size={16} />
            </Button>
          </Link>
        </div>
        {isAdmin && stores.length > 1 && (
          <div className="min-w-[180px]">
            <Select
              value={store.id}
              onChange={(e) => router.push(go(e.target.value, weekStart))}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Pre-payment summary */}
      <Card>
        <CardHeader
          action={
            confirmed ? (
              <Badge variant="success">Confirmed &amp; locked</Badge>
            ) : payout ? (
              <Badge variant="gold">Draft</Badge>
            ) : null
          }
        >
          <CardTitle>Pre-Payment Summary — {store.name}</CardTitle>
          <CardDescription>
            Wages due on Saturday {saturday} — for last week&apos;s work ({payWeekLabel})
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <SummaryRow label="Opening balance (carried forward)" value={formatGBP(fin.opening_balance)} />
              <SummaryRow label="Vita Mojo cash sales (Sun – payday Sat)" value={formatGBP(fin.vita_mojo_total)} />
              <SummaryRow label="Less: logged differences / cash used" value={`(${formatGBP(fin.logged_differences)})`} tone="bad" />
              <SummaryRow label="Actual cash available" value={formatGBP(fin.actual_cash_available)} strong />
              <SummaryRow label="Total cash wages due" value={`(${formatGBP(fin.total_cash_wages)})`} tone="bad" />
              <SummaryRow label="Total delivery wages due" value={`(${formatGBP(fin.total_delivery_wages)})`} tone="bad" />
              <SummaryRow label="Grand total wages due" value={`(${formatGBP(fin.grand_total_wages)})`} tone="bad" strong />
              {fin.post_office_draw > 0.001 ? (
                <SummaryRow
                  label="⚠ Post Office draw required"
                  value={formatGBP(fin.post_office_draw)}
                  tone="bad"
                  strong
                  highlight
                />
              ) : (
                <SummaryRow label="Surplus cash remaining after wages" value={formatGBP(fin.surplus)} tone="good" strong />
              )}
            </tbody>
          </table>
        </div>

        {fin.post_office_draw > 0.001 && (
          <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger font-medium">
            Draw {formatGBP(fin.post_office_draw)} from the Post Office before paying wages this Saturday.
          </div>
        )}
      </Card>

      {/* Wage breakdown */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Saturday Wage Breakdown</h3>
            <p className="text-sm text-text-muted mt-0.5">
              Hours &amp; deliveries from {payWeekLabel} ·{" "}
              {payout
                ? `${paidCount}/${payout.lines.length} marked paid`
                : "live forecast — generate the sheet to mark payments"}
            </p>
          </div>
          {!locked && (
            <Button onClick={doGenerate} loading={busy === "generate"} variant={payout ? "secondary" : "primary"}>
              {payout ? "Regenerate sheet" : "Generate payout sheet"}
            </Button>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-12">
            No employees have cash wages or deliveries to pay for {payWeekLabel}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-muted bg-bg/50">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium text-right">Cash hrs</th>
                  <th className="px-4 py-3 font-medium text-right">Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Deliveries</th>
                  <th className="px-4 py-3 font-medium text-right">Delivery £</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  {payout && <th className="px-4 py-3 font-medium text-center">Paid</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const lineId = l.id ?? null;
                  const isPaid = l.is_paid ?? false;
                  return (
                    <tr key={lineId ?? l.employee_name + i} className={`${i % 2 === 0 ? "" : "bg-bg/40"} border-t border-border/60`}>
                      <td className="px-4 py-3 font-medium text-text-primary">{l.employee_name}</td>
                      <td className="px-4 py-3 text-text-muted">{l.role ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.cash_hours.toFixed(2)}h</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatGBP(l.cash_rate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {l.deliveries_count > 0 ? l.deliveries_count : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {l.delivery_wages > 0 ? formatGBP(l.delivery_wages) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatGBP(l.total_payment)}</td>
                      {payout && (
                        <td className="px-4 py-3 text-center">
                          {lineId && (
                            <input
                              type="checkbox"
                              checked={isPaid}
                              disabled={locked || busy === lineId}
                              onChange={(e) => togglePaid(lineId, e.target.checked)}
                              className="h-4 w-4 accent-gold cursor-pointer disabled:cursor-not-allowed"
                              aria-label={`Mark ${l.employee_name} paid`}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-bg/60 font-semibold">
                  <td className="px-4 py-3" colSpan={6}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gold">
                    {formatGBP(lines.reduce((s, l) => s + l.total_payment, 0))}
                  </td>
                  {payout && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Confirmation footer */}
        {payout && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            {confirmed ? (
              <>
                <p className="text-sm text-success">
                  Confirmed by {payout.confirmed_by_name ?? "—"} on{" "}
                  {payout.confirmed_at ? `${formatDDMMYYYY(payout.confirmed_at)} ${formatTimeOnly(payout.confirmed_at)}` : "—"}
                </p>
                {isAdmin && (
                  <Button variant="danger" onClick={doUnlock} loading={busy === "unlock"}>
                    Unlock for amendment
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-text-muted">
                  Mark each employee paid, then confirm to lock the record and generate the weekly summary.
                </p>
                <Button
                  onClick={doConfirm}
                  loading={busy === "confirm"}
                  iconLeft={<CheckIcon size={16} />}
                  disabled={paidCount < payout.lines.length}
                >
                  Confirm all payments
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
  strong,
  highlight,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
  strong?: boolean;
  highlight?: boolean;
}) {
  const toneCls = tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-text-primary";
  return (
    <tr className={`border-t border-border/60 ${highlight ? "bg-danger/5" : ""}`}>
      <td className={`px-4 py-2.5 ${strong ? "font-semibold text-text-primary" : "text-text-subtle"}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${strong ? "font-semibold" : ""} ${toneCls}`}>{value}</td>
    </tr>
  );
}
