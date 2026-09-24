"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { saveReportLines, type ReportLineInput } from "@/app/actions/weekly-report";
import { NumberCell } from "@/components/weekly-report/NumberCell";
import { SheetSaveBar } from "@/components/weekly-report/SheetSaveBar";
import { useSheetDrafts } from "@/components/weekly-report/useSheetDrafts";
import {
  aggregatorRows,
  num,
  round2,
  sumSection,
  type WeeklyReportLine,
} from "@/lib/weekly-report";
import type { VmPlatformSales } from "@/lib/weekly-report-sales";

const cellNum =
  "w-28 rounded-md border border-border bg-bg px-2 py-1.5 text-right font-mono text-sm text-text-primary focus:border-gold focus:outline-none disabled:opacity-60";

/**
 * The aggregator sheet, half read-only.
 *
 * SALES COME FROM VM and are never typed — the platform's own revenue is already
 * ingested, and re-keying it is how two systems start disagreeing. They are
 * GROSS, which is both what the spreadsheet reports and the basis the platforms
 * charge their commission on, so Comm. % is comparable to the contracted rate.
 * The manager enters the COMMISSION; income is the subtraction. Only the
 * commission total reaches the P&L (summary line B29).
 *
 * Three fixed rows, always. Own Delivery and collection charge no commission,
 * so there is nothing to enter against them.
 */
export function AggregatorGrid({
  reportId,
  lines,
  platformSales,
  readOnly,
}: {
  reportId: string;
  lines: WeeklyReportLine[];
  platformSales: VmPlatformSales;
  readOnly: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const salesByPlatform = React.useMemo(
    () => new Map(platformSales.rows.map((p) => [p.platform, p.sales])),
    [platformSales],
  );
  const rows = React.useMemo(
    () => aggregatorRows(lines, salesByPlatform),
    [lines, salesByPlatform],
  );
  const [busy, setBusy] = React.useState(false);

  const signature = lines.map((l) => `${l.id}:${l.amount}`).join("|");
  const sheet = useSheetDrafts<Record<string, string>>(
    signature,
    () =>
      Object.fromEntries(
        aggregatorRows(lines, salesByPlatform).map((r) => [
          r.platform,
          r.commission ? String(r.commission) : "",
        ]),
      ),
    (d) => new Map(Object.entries(d)),
    readOnly,
  );
  const draft = sheet.state;

  async function save() {
    if (readOnly || busy) return;
    const payload: ReportLineInput[] = [];
    const kept = new Set<string>();
    for (const r of rows) {
      const raw = draft[r.platform] ?? "";
      if (raw === "") continue;
      if (r.line) kept.add(r.line.id);
      payload.push({
        key: r.platform,
        id: r.line?.id ?? null,
        section: "aggregator",
        label: r.platform,
        amount: round2(num(raw)),
      });
    }
    setBusy(true);
    try {
      await saveReportLines({
        report_id: reportId,
        lines: payload,
        // A commission cleared back to blank is a line that should no longer
        // reach the summary's Aggregator Costs.
        delete_ids: rows
          .map((r) => r.line?.id)
          .filter((id): id is string => !!id && !kept.has(id)),
      });
      toast.success("Aggregator commission saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the commission");
    } finally {
      setBusy(false);
    }
  }

  // The P&L takes the whole section, so commission left against a platform this
  // sheet no longer lists would reach the summary while being invisible here.
  const stranded = round2(sumSection(lines, "aggregator") - rows.reduce((t, r) => t + r.commission, 0));

  // Totals follow what is ON SCREEN, so the footer agrees with the rows while
  // a commission is still being typed.
  const totals = rows.reduce(
    (t, r) => {
      const commission = num(draft[r.platform] ?? "");
      return {
        sales: t.sales + r.sales,
        commission: t.commission + commission,
        income: t.income + round2(r.sales - commission),
      };
    },
    { sales: 0, commission: 0, income: 0 },
  );

  return (
    <div className="vm-card overflow-hidden" ref={sheet.sync.ref} onBlurCapture={sheet.sync.onBlurCapture}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Aggregator Summary</h3>
        <span className="text-xs text-text-muted">→ Weekly Summary, Aggregator Costs</span>
      </div>

      {stranded !== 0 && (
        <p className="border-b border-border px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          £{stranded.toFixed(2)} of commission is recorded against a platform this sheet no longer
          lists. It still reaches the summary&apos;s Aggregator Costs — re-enter it against one of
          the three rows below.
        </p>
      )}

      {platformSales.rows.length === 0 && (
        <p className="border-b border-border px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          No delivery-platform sales have synced for this week yet. Commission entered now is kept;
          the sales column fills in once the week lands.
        </p>
      )}

      <div className="table-scroll overflow-x-auto">
        <table className="grid-stack w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 text-left font-semibold">Platform</th>
              <th className="px-3 py-2 text-right font-semibold">
                {platformSales.basis === "gross" ? "Gross sales (VM)" : "Net sales (VM)"}
              </th>
              <th className="px-3 py-2 text-right font-semibold">Commission</th>
              <th className="px-3 py-2 text-right font-semibold">Income</th>
              <th className="px-3 py-2 text-right font-semibold">Comm. %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const value = draft[r.platform] ?? "";
              const commission = num(value);
              const income = round2(r.sales - commission);
              return (
                <tr key={r.platform} className="border-b border-border">
                  <td className="px-3 py-2 text-text-primary">{r.platform}</td>
                  <td
                    data-label={platformSales.basis === "gross" ? "Gross sales (VM)" : "Net sales (VM)"}
                    className="px-3 py-2 text-right font-mono text-text-secondary"
                  >
                    £{r.sales.toFixed(2)}
                  </td>
                  <td data-label="Commission" className="px-3 py-2 text-right">
                    <NumberCell
                      className={cellNum}
                      value={value}
                      disabled={readOnly}
                      placeholder="0.00"
                      onValueChange={(v) =>
                        sheet.setState((p) => ({ ...p, [r.platform]: v }))
                      }
                    />
                  </td>
                  <td data-label="Income" className="px-3 py-2 text-right font-mono text-text-primary">
                    £{income.toFixed(2)}
                  </td>
                  <td data-label="Comm. %" className="px-3 py-2 text-right font-mono text-text-muted">
                    {r.sales > 0 ? `${((commission / r.sales) * 100).toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-surface-hover font-semibold">
              <td className="px-3 py-2 text-text-primary">Total</td>
              <td data-label="Sales" className="px-3 py-2 text-right font-mono text-text-primary">
                £{totals.sales.toFixed(2)}
              </td>
              <td data-label="Commission" className="px-3 py-2 text-right font-mono text-text-primary">
                £{totals.commission.toFixed(2)}
              </td>
              <td data-label="Income" className="px-3 py-2 text-right font-mono text-text-primary">
                £{totals.income.toFixed(2)}
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <SheetSaveBar
          dirty={sheet.dirty}
          count={sheet.changed}
          busy={busy}
          onSave={save}
          onDiscard={sheet.reset}
        />
      )}
    </div>
  );
}
