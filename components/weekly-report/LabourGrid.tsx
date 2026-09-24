"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { NumberCell } from "@/components/weekly-report/NumberCell";
import { SheetSaveBar } from "@/components/weekly-report/SheetSaveBar";
import { useSheetDrafts } from "@/components/weekly-report/useSheetDrafts";
import {
  prefillLabour,
  saveLabourLines,
  type LabourLineInput,
} from "@/app/actions/weekly-report";
import {
  labourLineTotals,
  labourTotal,
  num,
  round2,
  type LabourSource,
  type WeeklyReportLabourLine,
} from "@/lib/weekly-report";

const cellNum =
  "w-20 rounded-md border border-border bg-bg px-2 py-1.5 text-right font-mono text-sm text-text-primary focus:border-gold focus:outline-none disabled:opacity-60";
const cellTotal = `${cellNum} w-24`;
const cellText =
  "w-full min-w-[9rem] rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text-primary focus:border-gold focus:outline-none disabled:opacity-60";

const SOURCE_LABEL: Record<string, string> = {
  employee: "Employee",
  cover_driver: "Cover driver",
  manager: "Manager",
  adhoc: "Ad hoc",
};

type Draft = {
  key: string;
  id: string | null;
  person_name: string;
  source: LabourSource;
  ni_hours: string;
  ni_rate: string;
  cash_hours: string;
  cash_rate: string;
  /** Blank = the ordinary case, hours x rate. A figure here replaces it. */
  ni_total_override: string;
  cash_total_override: string;
  deliveries: string;
  delivery_pay: string;
};

const NUMERIC_FIELDS = [
  "ni_hours",
  "ni_rate",
  "cash_hours",
  "cash_rate",
  "ni_total_override",
  "cash_total_override",
  "deliveries",
  "delivery_pay",
] as const;

type NumericField = (typeof NUMERIC_FIELDS)[number];

function str(v: number | string | null | undefined): string {
  return v == null || v === "" ? "" : String(num(v));
}

function toDraft(l: WeeklyReportLabourLine): Draft {
  return {
    key: l.id,
    id: l.id,
    person_name: l.person_name,
    source: l.source,
    ni_hours: str(l.ni_hours),
    ni_rate: str(l.ni_rate),
    cash_hours: str(l.cash_hours),
    cash_rate: str(l.cash_rate),
    ni_total_override: str(l.ni_total_override),
    cash_total_override: str(l.cash_total_override),
    deliveries: l.deliveries == null ? "" : String(l.deliveries),
    delivery_pay: str(l.delivery_pay),
  };
}

/** The draft as `labourLineTotals` reads it — blank overrides stay null. */
function asLine(d: Draft): WeeklyReportLabourLine {
  return {
    id: d.id ?? d.key,
    report_id: "",
    person_name: d.person_name,
    source: d.source,
    employee_id: null,
    cover_driver_id: null,
    manager_id: null,
    hours: round2(num(d.ni_hours) + num(d.cash_hours)),
    ni_hours: num(d.ni_hours),
    ni_rate: num(d.ni_rate),
    cash_hours: num(d.cash_hours),
    cash_rate: num(d.cash_rate),
    ni_total_override: d.ni_total_override === "" ? null : num(d.ni_total_override),
    cash_total_override: d.cash_total_override === "" ? null : num(d.cash_total_override),
    deliveries: d.deliveries === "" ? null : Math.round(num(d.deliveries)),
    delivery_pay: num(d.delivery_pay),
    sort_order: 0,
  };
}

function rowPrint(d: Draft): string {
  return [d.person_name.trim(), ...NUMERIC_FIELDS.map((f) => d[f])].join("\u0001");
}

/**
 * The Labour Cost sheet.
 *
 * The figure this produces is the FULL cost — NI hours + cash hours +
 * deliveries + a manager's fixed daily wage. It is deliberately NOT the Tuesday
 * payout's total, which excludes NI/bank hours because they go through PAYE.
 *
 * Prefill WRITES ROWS, which the manager then corrects; it is not a live join.
 * Re-running it replaces the prefilled rows and leaves ad-hoc ones untouched.
 *
 * NI total and Cash total are TYPEABLE. Most lines are hours x rate and the
 * columns simply show the product — but an outsourced job is bought as a job,
 * not by the hour ("India Out source": 45 hours covered for a flat £50), and
 * writing that as a rate either loses the hours or invents a rate nobody
 * agreed. Typing the total keeps both honest; clearing the cell returns the
 * line to the product.
 */
export function LabourGrid({
  reportId,
  lines,
  readOnly,
}: {
  reportId: string;
  lines: WeeklyReportLabourLine[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const newKey = React.useRef(0);

  const signature = lines
    .map(
      (l) =>
        `${l.id}:${l.ni_hours}:${l.ni_rate}:${l.cash_hours}:${l.cash_rate}:${l.ni_total_override}:${l.cash_total_override}:${l.deliveries}:${l.delivery_pay}`,
    )
    .join("|");
  const sheet = useSheetDrafts<Draft[]>(
    signature,
    () => lines.map(toDraft),
    (ds) => new Map(ds.map((d) => [d.key, rowPrint(d)])),
    readOnly,
  );
  const drafts = sheet.state;
  const setDrafts = sheet.setState;

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function setField(key: string, field: NumericField, value: string) {
    update(key, { [field]: value } as Partial<Draft>);
  }

  function remove(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function addAdhoc() {
    const name = newName.trim();
    if (!name) return;
    newKey.current += 1;
    setDrafts((prev) => [
      ...prev,
      {
        key: `new-${newKey.current}`,
        id: null,
        person_name: name,
        source: "adhoc",
        ni_hours: "",
        ni_rate: "",
        cash_hours: "",
        cash_rate: "",
        ni_total_override: "",
        cash_total_override: "",
        deliveries: "",
        delivery_pay: "",
      },
    ]);
    setNewName("");
    setAdding(false);
  }

  async function save() {
    if (readOnly || busy) return;
    if (drafts.some((d) => !d.person_name.trim())) {
      toast.error("Every line needs a name.");
      return;
    }

    const payload: LabourLineInput[] = drafts.map((d, index) => {
      const line = asLine(d);
      return {
        key: d.key,
        id: d.id,
        person_name: d.person_name,
        source: d.source,
        hours: round2(num(d.ni_hours) + num(d.cash_hours)),
        ni_hours: num(d.ni_hours),
        ni_rate: num(d.ni_rate),
        cash_hours: num(d.cash_hours),
        cash_rate: num(d.cash_rate),
        ni_total_override: line.ni_total_override as number | null,
        cash_total_override: line.cash_total_override as number | null,
        deliveries: line.deliveries,
        delivery_pay: num(d.delivery_pay),
        sort_order: index,
      };
    });
    const kept = new Set(drafts.map((d) => d.id).filter(Boolean) as string[]);

    setBusy(true);
    try {
      const res = await saveLabourLines({
        report_id: reportId,
        lines: payload,
        delete_ids: lines.map((l) => l.id).filter((id) => !kept.has(id)),
      });
      sheet.commit(drafts.map((d) => (d.id ? d : { ...d, id: res.ids[d.key] ?? null })));
      toast.success("Labour Cost saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the sheet");
    } finally {
      setBusy(false);
    }
  }

  async function runPrefill() {
    if (sheet.dirty && !window.confirm("Prefill replaces the rows below. Discard the unsaved changes?")) {
      return;
    }
    setBusy(true);
    try {
      const res = await prefillLabour({ report_id: reportId });
      toast.success(
        `Prefilled ${res.lines} ${res.lines === 1 ? "person" : "people"} from approved hours`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prefill failed");
    } finally {
      setBusy(false);
    }
  }

  const total = labourTotal(drafts.map(asLine));
  // Every column carries its own total, the way the workbook's Total row does —
  // including the two rate columns, which are a column sum rather than a rate
  // anyone is paid.
  const columnTotals = drafts.reduce(
    (t, d) => {
      const line = asLine(d);
      const lt = labourLineTotals(line);
      return {
        hours: t.hours + lt.hours,
        ni_hours: t.ni_hours + num(d.ni_hours),
        ni_rate: t.ni_rate + num(d.ni_rate),
        ni_total: t.ni_total + lt.ni_total,
        cash_hours: t.cash_hours + num(d.cash_hours),
        cash_rate: t.cash_rate + num(d.cash_rate),
        cash_total: t.cash_total + lt.cash_total,
        deliveries: t.deliveries + (line.deliveries ?? 0),
        delivery_pay: t.delivery_pay + lt.delivery_pay,
      };
    },
    {
      hours: 0,
      ni_hours: 0,
      ni_rate: 0,
      ni_total: 0,
      cash_hours: 0,
      cash_rate: 0,
      cash_total: 0,
      deliveries: 0,
      delivery_pay: 0,
    },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="vm-card overflow-hidden" ref={sheet.sync.ref} onBlurCapture={sheet.sync.onBlurCapture}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Labour Cost</h3>
            <p className="text-xs text-text-muted">
              → Weekly Summary, Labour. Full cost: NI + cash + deliveries — not the Tuesday payout
              total, which pays cash only. A manager&apos;s fixed daily wage is prefilled as their
              effective hourly rate over the hours they clocked. A line bought as a job rather than
              by the hour — outsourced cover, say — takes its total typed straight into NI Total or
              Cash Total; leave those blank and they stay hours × rate. The last column is the cash
              the person takes: Cash Total + Delivery Pay.
            </p>
          </div>
          {!readOnly && (
            <Button size="sm" variant="secondary" onClick={runPrefill} loading={busy}>
              Prefill from approved hours
            </Button>
          )}
        </div>

        <div className="table-scroll overflow-x-auto">
          <table className="grid-stack w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-right font-semibold" title="NI hours + cash hours">
                  Hours worked
                </th>
                <th className="px-3 py-2 text-right font-semibold">NI Hours worked</th>
                <th className="px-3 py-2 text-right font-semibold" title="The hourly rate on NI/bank hours">
                  NI Pay
                </th>
                <th className="px-3 py-2 text-right font-semibold" title="NI hours × NI Pay">
                  NI Total
                </th>
                <th className="px-3 py-2 text-right font-semibold">Cash Hours</th>
                <th className="px-3 py-2 text-right font-semibold" title="The hourly rate on cash hours">
                  Cash Pay
                </th>
                <th className="px-3 py-2 text-right font-semibold" title="Cash hours × Cash Pay">
                  Cash Total
                </th>
                <th className="px-3 py-2 text-right font-semibold">Deliveries</th>
                <th className="px-3 py-2 text-right font-semibold">Delivery Pay</th>
                <th className="px-3 py-2 text-right font-semibold" title="NI Total + Cash Total + Delivery Pay — the full cost">
                  Total Pay
                </th>
                <th
                  className="px-3 py-2 text-right font-semibold"
                  title="Cash Total + Delivery Pay — the cash this person takes"
                >
                  Cash Total
                </th>
                {!readOnly && <th className="w-10 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const t = labourLineTotals(asLine(d));
                const numField = (field: NumericField, integer = false) => (
                  <NumberCell
                    integer={integer}
                    className={cellNum}
                    value={d[field]}
                    disabled={readOnly}
                    onValueChange={(v) => setField(d.key, field, v)}
                  />
                );
                // A typed total makes the rate beside it decorative, so the
                // cell says so rather than leaving two figures that disagree.
                const totalField = (
                  field: "ni_total_override" | "cash_total_override",
                  computed: number,
                ) => (
                  <NumberCell
                    className={
                      d[field] === ""
                        ? cellTotal
                        : `${cellTotal} border-amber-400 text-amber-700 dark:text-amber-400`
                    }
                    title={
                      d[field] === ""
                        ? "Hours × rate. Type a figure to fix this total instead."
                        : "Typed total — not hours × rate. Clear the cell to go back."
                    }
                    placeholder={computed.toFixed(2)}
                    value={d[field]}
                    disabled={readOnly}
                    onValueChange={(v) => setField(d.key, field, v)}
                  />
                );
                return (
                  <tr key={d.key} className="border-b border-border">
                    <td className="px-3 py-1.5">
                      {d.source === "adhoc" ? (
                        <input
                          className={cellText}
                          value={d.person_name}
                          disabled={readOnly}
                          onChange={(e) => update(d.key, { person_name: e.target.value })}
                        />
                      ) : (
                        <div className="text-text-primary">
                          {d.person_name}
                          <span className="ml-2 text-xs text-text-muted">
                            {SOURCE_LABEL[d.source]}
                          </span>
                        </div>
                      )}
                    </td>
                    <td data-label="Hours worked" className="px-3 py-1.5 text-right font-mono text-text-secondary">
                      {t.hours.toFixed(2)}
                    </td>
                    <td data-label="NI Hours worked" className="px-3 py-1.5 text-right">{numField("ni_hours")}</td>
                    <td data-label="NI Pay" className="px-3 py-1.5 text-right">{numField("ni_rate")}</td>
                    <td data-label="NI Total" className="px-3 py-1.5 text-right">
                      {totalField("ni_total_override", round2(num(d.ni_hours) * num(d.ni_rate)))}
                    </td>
                    <td data-label="Cash Hours" className="px-3 py-1.5 text-right">{numField("cash_hours")}</td>
                    <td data-label="Cash Pay" className="px-3 py-1.5 text-right">{numField("cash_rate")}</td>
                    <td data-label="Cash Total" className="px-3 py-1.5 text-right">
                      {totalField("cash_total_override", round2(num(d.cash_hours) * num(d.cash_rate)))}
                    </td>
                    <td data-label="Deliveries" className="px-3 py-1.5 text-right">{numField("deliveries", true)}</td>
                    <td data-label="Delivery Pay" className="px-3 py-1.5 text-right">{numField("delivery_pay")}</td>
                    <td data-label="Total Pay" className="px-3 py-1.5 text-right font-mono font-semibold text-text-primary">
                      £{t.total_pay.toFixed(2)}
                    </td>
                    <td
                      data-label="Cash Total (cash + delivery)"
                      className="px-3 py-1.5 text-right font-mono text-text-secondary"
                    >
                      £{round2(t.cash_total + t.delivery_pay).toFixed(2)}
                    </td>
                    {!readOnly && (
                      <td data-role="remove" className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => remove(d.key)}
                          aria-label={`Remove ${d.person_name}`}
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
                  <td colSpan={13} className="px-3 py-6 text-center text-sm text-text-muted">
                    Nobody costed yet. Prefill from approved hours to start.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-surface-hover font-semibold">
                <td className="px-3 py-2 text-text-primary">Total labour cost</td>
                <td data-label="Hours worked" className="px-3 py-2 text-right font-mono text-text-primary">
                  {round2(columnTotals.hours).toFixed(2)}
                </td>
                <td data-label="NI Hours worked" className="px-3 py-2 text-right font-mono text-text-primary">
                  {round2(columnTotals.ni_hours).toFixed(2)}
                </td>
                <td data-label="NI Pay" className="px-3 py-2 text-right font-mono text-text-primary">
                  {round2(columnTotals.ni_rate).toFixed(2)}
                </td>
                <td data-label="NI Total" className="px-3 py-2 text-right font-mono text-text-primary">
                  £{round2(columnTotals.ni_total).toFixed(2)}
                </td>
                <td data-label="Cash Hours" className="px-3 py-2 text-right font-mono text-text-primary">
                  {round2(columnTotals.cash_hours).toFixed(2)}
                </td>
                <td data-label="Cash Pay" className="px-3 py-2 text-right font-mono text-text-primary">
                  {round2(columnTotals.cash_rate).toFixed(2)}
                </td>
                <td data-label="Cash Total" className="px-3 py-2 text-right font-mono text-text-primary">
                  £{round2(columnTotals.cash_total).toFixed(2)}
                </td>
                <td data-label="Deliveries" className="px-3 py-2 text-right font-mono text-text-primary">
                  {columnTotals.deliveries}
                </td>
                <td data-label="Delivery Pay" className="px-3 py-2 text-right font-mono text-text-primary">
                  £{round2(columnTotals.delivery_pay).toFixed(2)}
                </td>
                <td data-label="Total Pay" className="px-3 py-2 text-right font-mono text-text-primary">
                  £{total.toFixed(2)}
                </td>
                <td
                  data-label="Cash Total (cash + delivery)"
                  className="px-3 py-2 text-right font-mono text-text-primary"
                >
                  £{round2(columnTotals.cash_total + columnTotals.delivery_pay).toFixed(2)}
                </td>
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
            {adding ? (
              <>
                <input
                  autoFocus
                  className={cellText}
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAdhoc()}
                />
                <Button size="sm" onClick={addAdhoc}>
                  Add
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={busy}>
                Add Employee Pay
              </Button>
            )}
          </SheetSaveBar>
        )}
      </div>
    </div>
  );
}
