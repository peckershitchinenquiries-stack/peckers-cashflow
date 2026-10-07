"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { saveReportNote } from "@/app/actions/weekly-report";
import { useUnsavedGuard } from "@/components/weekly-report/SheetSaveBar";
import { useStashedForm } from "@/components/weekly-report/useSheetDrafts";
import { NOTE_PLACEHOLDERS, type ReportTab } from "@/lib/weekly-report";

/**
 * The empty column beside the paper grid.
 *
 * Every sheet the stores send carries working that nothing sums — "113,142,170
 * oil" next to Magna, a string of invoice numbers next to MS Foods — written
 * for the manager's own clarity and for whoever queries the week later. There
 * was nowhere to put it, so it stopped at the spreadsheet.
 *
 * Record only, and deliberately not carried into next week: these are THIS
 * week's invoice numbers, not a structure, the same reason the expense sheet
 * is not carried either.
 */
export function SheetNotes({
  reportId,
  tab,
  note,
  readOnly,
}: {
  reportId: string;
  tab: ReportTab;
  note: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  const stash = useStashedForm(
    `${reportId}:note:${tab}`,
    note,
    () => ({ body: note }),
    readOnly,
  );
  const { form, setForm, dirty, kept } = stash;
  useUnsavedGuard(dirty, kept);

  async function save() {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      await saveReportNote({ report_id: reportId, tab, body: form.body });
      stash.saved();
      toast.success("Note saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the note");
    } finally {
      setBusy(false);
    }
  }

  if (readOnly && !note.trim()) return null;

  return (
    <div className="vm-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Notes</h3>
        <span className="text-xs text-text-muted">
          Record only — nothing here is totalled or reaches the P&amp;L
        </span>
      </div>

      <div className="px-4 py-3">
        {readOnly ? (
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{note}</p>
        ) : (
          <textarea
            rows={3}
            value={form.body}
            placeholder={NOTE_PLACEHOLDERS[tab]}
            onChange={(e) => setForm({ body: e.target.value })}
            className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <span className="text-xs text-text-muted">
            Travels with the week — it lands on this sheet in the Excel the owners receive.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={
                dirty
                  ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                  : "text-xs text-text-muted"
              }
            >
              {dirty
                ? `Unsaved${kept ? " — kept on this device until you save" : ""}`
                : "Saved"}
            </span>
            <Button size="sm" onClick={save} loading={busy} disabled={!dirty}>
              Save note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
