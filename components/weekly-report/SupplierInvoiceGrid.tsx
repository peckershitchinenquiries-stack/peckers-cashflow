"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { saveReportLines, type ReportLineInput } from "@/app/actions/weekly-report";
import { NumberCell } from "@/components/weekly-report/NumberCell";
import { SheetSaveBar } from "@/components/weekly-report/SheetSaveBar";
import { useSheetDrafts } from "@/components/weekly-report/useSheetDrafts";
import {
  MAX_INVOICE_COLUMNS,
  MIN_INVOICE_COLUMNS,
  groupSupplierLines,
  lineAmount,
  num,
  round2,
  type SectionDef,
  type WeeklyReportLine,
} from "@/lib/weekly-report";

const cell =
  "w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text-primary focus:border-gold focus:outline-none disabled:opacity-60";
const cellNum = `${cell} text-right font-mono`;

type InvoiceCell = {
  id: string | null;
  amount: string;
  /** Preserved, never edited here — the column header is the invoice's name now. */
  note: string | null;
};

type SupplierDraft = {
  key: string;
  label: string;
  invoices: InvoiceCell[];
};

type Sheet = {
  drafts: SupplierDraft[];
  columns: number;
};

function toSheet(lines: WeeklyReportLine[]): Sheet {
  const groups = groupSupplierLines(lines);
  const widest = groups.reduce((n, g) => Math.max(n, g.invoices.length), 0);
  return {
    drafts: groups.map((g) => ({
      key: g.key,
      label: g.label,
      invoices: g.invoices.map((l) => ({
        id: l.id,
        amount: String(lineAmount(l)),
        note: l.note,
      })),
    })),
    columns: Math.min(MAX_INVOICE_COLUMNS, Math.max(MIN_INVOICE_COLUMNS, widest)),
  };
}

function draftTotal(d: SupplierDraft): number {
  return round2(d.invoices.reduce((t, i) => t + (i.amount === "" ? 0 : num(i.amount)), 0));
}

/**
 * What a row would be stored as, so "has it changed" is one comparison.
 * Trailing blanks are trimmed: widening or narrowing the grid over empty cells
 * changes nothing that would be written, and must not read as an edit.
 */
function rowPrint(d: SupplierDraft): string {
  const cells = d.invoices.map((i) =>
    i.amount === "" ? "" : String(round2(num(i.amount))),
  );
  while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return `${d.label.trim().toLowerCase()}=${cells.join(",")}`;
}

/**
 * Cost of Goods, in the shape of the sheet it replaces: ONE ROW PER SUPPLIER
 * with a column per invoice and the supplier's week total on the right.
 *
 * The rows underneath are still one per invoice — that is what the P&L sums —
 * so this grid groups them on the supplier name and writes each cell back to
 * its own row. Typing a supplier three times to enter three invoices was the
 * spreadsheet turned inside out.
 *
 * NOTHING is written until Save. Saving each cell on blur meant a server action
 * and a full page revalidate between every invoice on a fifteen-supplier week,
 * which is the lag between rows managers were hitting; the whole grid now goes
 * up in one call.
 */
export function SupplierInvoiceGrid({
  reportId,
  def,
  lines,
  readOnly,
}: {
  reportId: string;
  def: SectionDef;
  lines: WeeklyReportLine[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const newKey = React.useRef(0);

  const signature = lines.map((l) => `${l.id}:${l.label}:${l.amount}`).join("|");
  const grid = useSheetDrafts<Sheet>(
    signature,
    () => toSheet(lines),
    (s) => new Map(s.drafts.map((d) => [d.key, rowPrint(d)])),
    readOnly,
  );
  const sheet = grid.state;
  const setSheet = grid.setState;

  const { drafts, columns } = sheet;

  function update(key: string, patch: Partial<SupplierDraft>) {
    setSheet((s) => ({
      ...s,
      drafts: s.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    }));
  }

  function setCell(key: string, column: number, value: string) {
    setSheet((s) => ({
      ...s,
      drafts: s.drafts.map((d) => {
        if (d.key !== key) return d;
        const invoices = [...d.invoices];
        while (invoices.length <= column) invoices.push({ id: null, amount: "", note: null });
        invoices[column] = { ...invoices[column], amount: value };
        return { ...d, invoices };
      }),
    }));
  }

  function addSupplier() {
    newKey.current += 1;
    setSheet((s) => ({
      ...s,
      drafts: [...s.drafts, { key: `new-${newKey.current}`, label: "", invoices: [] }],
    }));
  }

  function removeSupplier(key: string) {
    setSheet((s) => ({ ...s, drafts: s.drafts.filter((d) => d.key !== key) }));
  }

  function addColumn() {
    setSheet((s) => ({ ...s, columns: Math.min(MAX_INVOICE_COLUMNS, s.columns + 1) }));
  }

  /**
   * Drop an invoice column across every supplier, closing the gap behind it.
   * A column added by mistake, or one whose invoices were all voided, could
   * only ever be added before — the grid grew and never shrank.
   */
  function removeColumn(column: number) {
    const holds = drafts.some((d) => (d.invoices[column]?.amount ?? "") !== "");
    if (
      holds &&
      !window.confirm(
        `Invoice ${column + 1} has amounts entered against it. Remove the column and those amounts?`,
      )
    ) {
      return;
    }
    setSheet((s) => ({
      columns: Math.max(MIN_INVOICE_COLUMNS, s.columns - 1),
      drafts: s.drafts.map((d) => ({
        ...d,
        invoices: d.invoices.filter((_, i) => i !== column),
      })),
    }));
  }

  async function save() {
    if (readOnly || busy) return;
    if (drafts.some((d) => !d.label.trim() && d.invoices.some((i) => i.amount !== ""))) {
      toast.error("Every row with an amount needs a supplier name.");
      return;
    }

    const payload: ReportLineInput[] = [];
    const kept = new Set<string>();
    drafts.forEach((d, index) => {
      const label = d.label.trim();
      if (!label) return;
      for (let column = 0; column < columns; column++) {
        const invoice = d.invoices[column];
        if (!invoice || invoice.amount === "") continue;
        if (invoice.id) kept.add(invoice.id);
        payload.push({
          key: `${d.key}:${column}`,
          id: invoice.id,
          section: def.key,
          label,
          // Suppliers are spaced apart so a supplier's invoices always order
          // together, whatever order the cells were typed in.
          sort_order: index * MAX_INVOICE_COLUMNS + column,
          amount: round2(num(invoice.amount)),
          note: invoice.note,
        });
      }
    });

    setBusy(true);
    try {
      const res = await saveReportLines({
        report_id: reportId,
        lines: payload,
        // Anything the sheet no longer shows — a supplier removed, a cell
        // cleared, a column dropped — goes in the same call.
        delete_ids: lines.map((l) => l.id).filter((id) => !kept.has(id)),
      });
      // Adopt the new ids so a second Save updates these rows rather than
      // inserting them again.
      grid.commit({
        ...sheet,
        drafts: sheet.drafts.map((d) => ({
          ...d,
          invoices: d.invoices.map((inv, i) =>
            inv.id ? inv : { ...inv, id: res.ids[`${d.key}:${i}`] ?? null },
          ),
        })),
      });
      toast.success("Cost of Goods saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the sheet");
    } finally {
      setBusy(false);
    }
  }

  const total = round2(drafts.reduce((t, d) => t + draftTotal(d), 0));
  const columnIndexes = Array.from({ length: columns }, (_, i) => i);

  return (
    <div className="vm-card overflow-hidden" ref={grid.sync.ref} onBlurCapture={grid.sync.onBlurCapture}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{def.title}</h3>
        <span className="text-xs text-text-muted">
          {def.feeds ? `→ Weekly Summary, ${def.feeds}` : "Record only — does not affect the P&L"}
        </span>
      </div>

      <div className="table-scroll overflow-x-auto">
        <table className="grid-stack w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 text-left font-semibold">{def.labelHeading}</th>
              {columnIndexes.map((i) => (
                <th key={i} className="px-3 py-2 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Invoice {i + 1}
                    {!readOnly && columns > MIN_INVOICE_COLUMNS && (
                      <button
                        type="button"
                        onClick={() => removeColumn(i)}
                        aria-label={`Remove invoice ${i + 1} column`}
                        title={`Remove invoice ${i + 1} column`}
                        className="rounded px-1 leading-none text-text-muted transition hover:bg-surface hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.key} className="border-b border-border">
                <td className="px-3 py-1.5">
                  <input
                    className={cell}
                    value={d.label}
                    placeholder={def.labelHeading}
                    disabled={readOnly}
                    onChange={(e) => update(d.key, { label: e.target.value })}
                  />
                </td>
                {columnIndexes.map((i) => (
                  <td key={i} data-label={`Invoice ${i + 1}`} className="px-3 py-1.5">
                    <NumberCell
                      className={cellNum}
                      placeholder="0.00"
                      value={d.invoices[i]?.amount ?? ""}
                      disabled={readOnly}
                      onValueChange={(v) => setCell(d.key, i, v)}
                    />
                  </td>
                ))}
                <td data-label="Total" className="px-3 py-1.5 text-right font-mono text-text-primary">
                  £{draftTotal(d).toFixed(2)}
                </td>
                {!readOnly && (
                  <td data-role="remove" className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeSupplier(d.key)}
                      aria-label={`Remove ${d.label || "supplier"}`}
                      className="rounded px-2 py-1 text-text-muted transition hover:bg-surface-hover hover:text-red-500"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {drafts.length === 0 && (
              <tr>
                <td
                  colSpan={columns + 3}
                  className="px-3 py-6 text-center text-sm text-text-muted"
                >
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-surface-hover font-semibold">
              <td className="px-3 py-2 text-text-primary" colSpan={columns + 1}>
                Totals
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">
                £{total.toFixed(2)}
              </td>
              {!readOnly && <td className="px-2 py-2" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <SheetSaveBar
          dirty={grid.dirty}
          count={grid.changed}
          busy={busy}
          onSave={save}
          onDiscard={grid.reset}
        >
          <Button size="sm" variant="secondary" onClick={addSupplier} disabled={busy}>
            Add supplier
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={addColumn}
            disabled={busy || columns >= MAX_INVOICE_COLUMNS}
          >
            Add invoice column
          </Button>
        </SheetSaveBar>
      )}
    </div>
  );
}
