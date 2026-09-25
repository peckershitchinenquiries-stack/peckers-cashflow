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
  expenseVat,
  money,
  num,
  round2,
  type SectionDef,
  type WeeklyReportLine,
} from "@/lib/weekly-report";

/** Blank VAT means the standard rate, so an untouched line behaves as before. */
function draftVat(d: Draft, amount: number): number {
  return d.vat === "" ? expenseVat(amount) : round2(num(d.vat));
}

const cell =
  "w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text-primary focus:border-gold focus:outline-none disabled:opacity-60";
const cellNum = `${cell} text-right font-mono`;

type Draft = {
  id: string | null;
  label: string;
  qty: string;
  unit_rate: string;
  amount: string;
  vat: string;
  entry_date: string;
  note: string;
  /** Client-only key so a row that has never been saved still has React identity. */
  key: string;
};

function toDraft(l: WeeklyReportLine): Draft {
  return {
    id: l.id,
    label: l.label,
    qty: l.qty == null ? "" : String(num(l.qty)),
    unit_rate: l.unit_rate == null ? "" : String(num(l.unit_rate)),
    amount: l.amount == null ? "" : String(num(l.amount)),
    vat: l.vat_amount == null ? "" : String(num(l.vat_amount)),
    entry_date: l.entry_date ?? "",
    note: l.note ?? "",
    key: l.id,
  };
}

function draftAmount(d: Draft, shape: SectionDef["shape"]): number {
  if (shape === "qty_rate") return round2(num(d.qty) * num(d.unit_rate));
  return num(d.amount);
}

/** A row the manager started and abandoned — nothing in it to record. */
function isBlankRow(d: Draft): boolean {
  return (
    !d.label.trim() &&
    !d.entry_date &&
    !d.note.trim() &&
    d.amount.trim() === "" &&
    d.vat.trim() === "" &&
    d.qty.trim() === "" &&
    num(d.qty) === 0
  );
}

function rowPrint(d: Draft): string {
  return [d.label.trim(), d.qty, d.unit_rate, d.amount, d.vat, d.entry_date, d.note].join("\u0001");
}

/**
 * The spreadsheet-style grid every section but Labour uses.
 *
 * NOTHING is written until Save. Edits used to go up on blur, which is a server
 * action and a full page revalidate per cell — the whole sheet now travels in
 * one call, so entering it costs the same whether it holds two rows or twenty.
 * A row with no label is never sent on a section that requires one. Where the
 * label is optional (Weekly Expenses, which on paper is receipts in a pile),
 * only a wholly empty row is dropped.
 */
export function LineItemGrid({
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

  // Server data wins whenever it changes underneath us (a prefill, a lock, a
  // carry-forward seed) — the grid is a view of the rows, not their owner. It
  // never wins over unsaved typing.
  const signature = lines
    .map((l) => `${l.id}:${l.label}:${l.amount}:${l.vat_amount}:${l.qty}:${l.unit_rate}`)
    .join("|");
  const sheet = useSheetDrafts<Draft[]>(
    signature,
    () => lines.map(toDraft),
    (ds) => new Map(ds.map((d) => [d.key, rowPrint(d)])),
    readOnly,
  );
  const drafts = sheet.state;
  const setDrafts = sheet.setState;

  const isQtyRate = def.shape === "qty_rate";
  const isDated = def.shape === "dated";

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function remove(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function addRow() {
    newKey.current += 1;
    setDrafts((prev) => [
      ...prev,
      {
        id: null,
        label: "",
        qty: "",
        unit_rate: def.defaultUnitRate != null ? String(def.defaultUnitRate) : "",
        amount: "",
        vat: "",
        entry_date: "",
        note: "",
        key: `new-${newKey.current}`,
      },
    ]);
  }

  async function save() {
    if (readOnly || busy) return;
    if (
      !def.labelOptional &&
      drafts.some((d) => !d.label.trim() && draftAmount(d, def.shape) !== 0)
    ) {
      toast.error(`Every row with an amount needs a ${def.labelHeading.toLowerCase()}.`);
      return;
    }

    const payload: ReportLineInput[] = [];
    const kept = new Set<string>();
    drafts.forEach((d, index) => {
      if (def.labelOptional ? isBlankRow(d) : !d.label.trim()) return;
      if (d.id) kept.add(d.id);
      payload.push({
        key: d.key,
        id: d.id,
        section: def.key,
        label: d.label,
        sort_order: index,
        entry_date: isDated ? d.entry_date || null : null,
        qty: isQtyRate ? num(d.qty) : null,
        unit_rate: isQtyRate ? num(d.unit_rate) : null,
        amount: draftAmount(d, def.shape),
        vat_amount: isDated && d.vat !== "" ? round2(num(d.vat)) : null,
        note: d.note || null,
      });
    });

    setBusy(true);
    try {
      const res = await saveReportLines({
        report_id: reportId,
        lines: payload,
        delete_ids: lines.map((l) => l.id).filter((id) => !kept.has(id)),
      });
      sheet.commit(drafts.map((d) => (d.id ? d : { ...d, id: res.ids[d.key] ?? null })));
      toast.success(`${def.title} saved`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the sheet");
    } finally {
      setBusy(false);
    }
  }

  const total = round2(drafts.reduce((t, d) => t + draftAmount(d, def.shape), 0));
  const vatTotal = round2(
    drafts.reduce((t, d) => t + draftVat(d, draftAmount(d, def.shape)), 0),
  );

  return (
    <div className="vm-card overflow-hidden" ref={sheet.sync.ref} onBlurCapture={sheet.sync.onBlurCapture}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{def.title}</h3>
        <span className="text-xs text-text-muted">
          {def.feeds ? `→ Weekly Summary, ${def.feeds}` : "Record only — does not affect the P&L"}
        </span>
      </div>

      <div className="table-scroll overflow-x-auto">
        <table className="grid-stack w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-text-muted">
              {isDated && <th className="px-3 py-2 text-left font-semibold">Date</th>}
              <th className="px-3 py-2 text-left font-semibold">{def.labelHeading}</th>
              {isQtyRate && <th className="px-3 py-2 text-right font-semibold">Qty</th>}
              {isQtyRate && <th className="px-3 py-2 text-right font-semibold">£ / unit</th>}
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              {isDated && <th className="px-3 py-2 text-right font-semibold">VAT</th>}
              <th className="px-3 py-2 text-left font-semibold">
                {isDated ? "Paid by" : "Note"}
              </th>
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const amount = draftAmount(d, def.shape);
              return (
                <tr key={d.key} className="border-b border-border">
                  {isDated && (
                    <td data-label="Date" className="px-3 py-1.5">
                      <input
                        type="date"
                        className={cell}
                        value={d.entry_date}
                        disabled={readOnly}
                        onChange={(e) => update(d.key, { entry_date: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <input
                      className={cell}
                      value={d.label}
                      placeholder={def.labelOptional ? `${def.labelHeading} (optional)` : def.labelHeading}
                      disabled={readOnly}
                      onChange={(e) => update(d.key, { label: e.target.value })}
                    />
                  </td>
                  {isQtyRate && (
                    <td data-label="Qty" className="px-3 py-1.5">
                      <NumberCell
                        allowNegative
                        className={cellNum}
                        value={d.qty}
                        disabled={readOnly}
                        onValueChange={(v) => update(d.key, { qty: v })}
                      />
                    </td>
                  )}
                  {isQtyRate && (
                    <td data-label="£ / unit" className="px-3 py-1.5">
                      <NumberCell
                        allowNegative
                        className={cellNum}
                        value={d.unit_rate}
                        disabled={readOnly}
                        onValueChange={(v) => update(d.key, { unit_rate: v })}
                      />
                    </td>
                  )}
                  <td data-label="Amount" className="px-3 py-1.5">
                    {isQtyRate ? (
                      <div className="px-2 py-1.5 text-right font-mono text-text-primary">
                        {money(amount)}
                      </div>
                    ) : (
                      <NumberCell
                        allowNegative
                        className={cellNum}
                        value={d.amount}
                        disabled={readOnly}
                        onValueChange={(v) => update(d.key, { amount: v })}
                      />
                    )}
                  </td>
                  {isDated && (
                    <td data-label="VAT" className="px-3 py-1.5">
                      <NumberCell
                        allowNegative
                        className={cellNum}
                        value={d.vat}
                        placeholder={expenseVat(amount).toFixed(2)}
                        disabled={readOnly}
                        onValueChange={(v) => update(d.key, { vat: v })}
                      />
                    </td>
                  )}
                  <td data-label={isDated ? "Paid by" : "Note"} className="px-3 py-1.5">
                    <input
                      className={cell}
                      value={d.note}
                      placeholder={isDated ? "Cash / card" : "Invoice ref"}
                      disabled={readOnly}
                      onChange={(e) => update(d.key, { note: e.target.value })}
                    />
                  </td>
                  {!readOnly && (
                    <td data-role="remove" className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => remove(d.key)}
                        aria-label={`Remove ${d.label || "line"}`}
                        className="rounded px-2 py-1 text-text-muted transition hover:bg-surface-hover hover:text-red-500"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {drafts.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-text-muted"
                >
                  No lines yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-surface-hover font-semibold">
              <td
                className="px-3 py-2 text-text-primary"
                colSpan={(isDated ? 2 : 1) + (isQtyRate ? 2 : 0)}
              >
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">
                {money(total)}
              </td>
              {isDated && (
                <td data-label="VAT" className="px-3 py-2 text-right font-mono text-text-muted">
                  {money(vatTotal)}
                </td>
              )}
              <td className="px-3 py-2" />
              {!readOnly && <td className="px-2 py-2" />}
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
        >
          <Button size="sm" variant="secondary" onClick={addRow} disabled={busy}>
            Add line
          </Button>
        </SheetSaveBar>
      )}
    </div>
  );
}
