"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  PencilIcon,
} from "@/components/ui/icons";
import { upsertDailyCashEntry, deleteDailyCashEntry } from "@/app/actions/cash-flow";
import { runningBalanceRows } from "@/lib/cash-flow";
import {
  formatDDMMYYYY,
  formatGBP,
  todayISO,
  weekLabel,
  parseISODate,
  startOfISOWeek,
  toISODate,
} from "@/lib/utils";
import type { DailyCashEntry } from "@/lib/types";

type StoreOpt = { id: string; name: string };

export function DailyCashView({
  stores,
  entries,
  weekStart,
  prevWeek,
  nextWeek,
  openingByStore,
  isAdmin,
  basePath,
  defaultStoreId,
}: {
  stores: StoreOpt[];
  entries: DailyCashEntry[];
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  openingByStore: Record<string, number>;
  isAdmin: boolean;
  basePath: string;
  defaultStoreId: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [storeId, setStoreId] = React.useState<string>(defaultStoreId);
  const weekEndDate = new Date(parseISODate(weekStart).getTime() + 6 * 86400000);
  const weekEnd = formatDDMMYYYY(weekEndDate);

  const inWeek = (iso: string) => {
    const endISO = new Date(parseISODate(weekStart).getTime() + 6 * 86400000);
    const end = `${endISO.getFullYear()}-${String(endISO.getMonth() + 1).padStart(2, "0")}-${String(endISO.getDate()).padStart(2, "0")}`;
    return iso >= weekStart && iso <= end;
  };
  const today = todayISO();
  const defaultDate = inWeek(today) ? today : weekStart;

  const [date, setDate] = React.useState<string>(defaultDate);
  const [vita, setVita] = React.useState("");
  const [envelope, setEnvelope] = React.useState("");
  const [supermarket, setSupermarket] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // The date picker is a full calendar. If a date outside the loaded week is
  // chosen, jump to that week so its entries (and any existing row) load.
  function onDateChange(next: string) {
    setDate(next);
    if (next && !inWeek(next)) {
      const wk = toISODate(startOfISOWeek(parseISODate(next)));
      router.push(`${basePath}/daily?week=${wk}`);
    }
  }
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const storeEntries = React.useMemo(
    () => entries.filter((e) => e.store_id === storeId),
    [entries, storeId],
  );

  // Pre-fill the form when an entry already exists for the chosen store+date.
  const existing = React.useMemo(
    () => storeEntries.find((e) => e.entry_date === date) ?? null,
    [storeEntries, date],
  );

  React.useEffect(() => {
    if (existing) {
      setVita(String(existing.vita_mojo_sales));
      setEnvelope(String(existing.envelope_amount));
      setSupermarket(
        existing.supermarket_expenses ? String(existing.supermarket_expenses) : "",
      );
      setReason(existing.reason ?? "");
    } else {
      setVita("");
      setEnvelope("");
      setSupermarket("");
      setReason("");
    }
  }, [existing]);

  const vitaNum = Number(vita) || 0;
  const envNum = Number(envelope) || 0;
  const difference = Math.round((vitaNum - envNum) * 100) / 100;
  const hasDiff = Math.abs(difference) > 0.001;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (vita === "" || envelope === "") {
      toast.error("Vita Mojo figure and envelope amount are both required.");
      return;
    }
    if (hasDiff && !reason.trim()) {
      toast.error("A reason is required when there is a difference.");
      return;
    }
    setBusy(true);
    try {
      const res = await upsertDailyCashEntry({
        store_id: storeId,
        entry_date: date,
        vita_mojo_sales: vitaNum,
        envelope_amount: envNum,
        supermarket_expenses: Number(supermarket) || 0,
        reason: reason.trim() || null,
      });
      toast.success(
        res.is_late
          ? "Saved (flagged as a late submission)"
          : existing
            ? "Entry updated"
            : "Entry saved",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this cash entry? This is logged and cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteDailyCashEntry({ id });
      toast.success("Entry deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeletingId(null);
    }
  }

  const opening = openingByStore[storeId] ?? 0;
  const rows = runningBalanceRows(storeEntries, opening);
  const runningBalance = rows.length ? rows[rows.length - 1].running_balance : opening;
  const vitaTotal = rows.reduce((s, r) => s + r.vita_mojo_sales, 0);
  const envTotal = rows.reduce((s, r) => s + r.envelope_amount, 0);
  const diffTotal = Math.round((vitaTotal - envTotal) * 100) / 100;

  return (
    <div className="flex flex-col gap-5">
      {/* Week navigation + store selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={`${basePath}/daily?week=${prevWeek}`}>
            <Button variant="secondary" size="icon" aria-label="Previous week">
              <ChevronLeftIcon size={16} />
            </Button>
          </Link>
          <span className="text-sm font-medium text-text-primary min-w-[180px] text-center">
            {weekLabel(parseISODate(weekStart))}
          </span>
          <Link href={`${basePath}/daily?week=${nextWeek}`}>
            <Button variant="secondary" size="icon" aria-label="Next week">
              <ChevronRightIcon size={16} />
            </Button>
          </Link>
        </div>
        {isAdmin && stores.length > 1 && (
          <div className="min-w-[180px]">
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* Entry form */}
        <Card>
          <CardHeader
            action={
              existing ? (
                <Badge variant={existing.is_late ? "warning" : "gold"}>
                  {existing.is_late ? "Late" : "Logged"}
                </Badge>
              ) : null
            }
          >
            <CardTitle>Daily Cash Entry</CardTitle>
            <CardDescription>
              Record the Vita Mojo end-of-day figure against the envelope.
            </CardDescription>
          </CardHeader>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
              type="date"
              label="Date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              required
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              label="Vita Mojo cash sales *"
              prefix="£"
              placeholder="0.00"
              value={vita}
              onChange={(e) => setVita(e.target.value)}
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              label="Cash placed in envelope *"
              prefix="£"
              placeholder="0.00"
              value={envelope}
              onChange={(e) => setEnvelope(e.target.value)}
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              label="Supermarket expenses"
              prefix="£"
              placeholder="0.00"
              value={supermarket}
              onChange={(e) => setSupermarket(e.target.value)}
            />

            <div className="rounded-xl bg-bg border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-text-muted">
                Difference {difference > 0 ? "(shortfall)" : difference < 0 ? "(surplus)" : ""}
              </span>
              <span
                className={
                  !hasDiff
                    ? "font-semibold text-success"
                    : difference > 0
                      ? "font-semibold text-danger"
                      : "font-semibold text-warning"
                }
              >
                {formatGBP(difference)}
              </span>
            </div>

            {hasDiff && (
              <Input
                label="Reason for difference *"
                placeholder="e.g. Supermarket run – £29 used for supplies"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            )}

            <Button type="submit" loading={busy} className="w-full mt-1">
              {existing ? "Update Entry" : "Save Entry"}
            </Button>
          </form>
        </Card>

        {/* Weekly log */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold text-text-primary">This Week&apos;s Cash Log</h3>
              <p className="text-sm text-text-muted mt-0.5">
                {formatDDMMYYYY(weekStart)} – {weekEnd}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Running balance</p>
              <p className="text-lg font-semibold text-gold tabular-nums">
                {formatGBP(runningBalance)}
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-12">
              No entries this week yet. Add today&apos;s entry on the left.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-text-muted bg-bg/50">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">Vita Mojo</th>
                    <th className="px-4 py-3 font-medium text-right">Envelope</th>
                    <th className="px-4 py-3 font-medium text-right">Diff</th>
                    <th className="px-4 py-3 font-medium">Reason / Status</th>
                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                    {isAdmin && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const entry = storeEntries.find((e) => e.entry_date === r.entry_date)!;
                    const balanced = Math.abs(r.difference) < 0.001;
                    return (
                      <tr
                        key={r.entry_date}
                        className={`${i % 2 === 0 ? "" : "bg-bg/40"} border-t border-border/60`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            className="hover:text-gold"
                            onClick={() => setDate(r.entry_date)}
                            title="Edit this day"
                          >
                            {formatDDMMYYYY(r.entry_date)}
                          </button>
                          {r.is_late && (
                            <Badge variant="warning" className="ml-2 text-[10px] py-0 px-1.5">
                              Late
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatGBP(r.vita_mojo_sales)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatGBP(r.envelope_amount)}</td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            balanced ? "text-text-muted" : r.difference > 0 ? "text-danger" : "text-warning"
                          }`}
                        >
                          {formatGBP(r.difference)}
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          {balanced ? (
                            <Badge variant="success">Balanced</Badge>
                          ) : (
                            <span className="text-text-subtle truncate block" title={r.reason ?? ""}>
                              {r.reason ?? "Discrepancy logged"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatGBP(r.running_balance)}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDate(r.entry_date)}
                                aria-label="Edit"
                                className="text-text-muted hover:text-text-primary"
                              >
                                <PencilIcon size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(entry.id)}
                                loading={deletingId === entry.id}
                                aria-label="Delete"
                                className="text-text-muted hover:text-danger"
                              >
                                <TrashIcon size={16} />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-bg/60 font-semibold">
                    <td className="px-4 py-3">Weekly total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatGBP(vitaTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatGBP(envTotal)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${diffTotal > 0 ? "text-danger" : "text-text-muted"}`}>
                      {formatGBP(diffTotal)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {opening > 0 ? `Opening ${formatGBP(opening)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gold">{formatGBP(runningBalance)}</td>
                    {isAdmin && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
