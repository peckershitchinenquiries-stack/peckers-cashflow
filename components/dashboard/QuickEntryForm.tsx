"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { upsertCashEntry } from "@/app/actions/entries";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import type { CashEntry } from "@/lib/types";
import { formatINR } from "@/lib/utils";

type Props = {
  existing: CashEntry | null;
  today: string;
};

export function QuickEntryForm({ existing, today }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [date, setDate] = React.useState<string>(existing?.entry_date || today);
  const [sales, setSales] = React.useState<string>(
    existing ? String(existing.cash_sales) : "",
  );
  const [exp, setExp] = React.useState<string>(
    existing ? String(existing.supermarket_expenses) : "",
  );
  const [notes, setNotes] = React.useState<string>(existing?.notes || "");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<{ [k: string]: string }>({});

  const salesNum = Number(sales) || 0;
  const expNum = Number(exp) || 0;
  const net = salesNum - expNum;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!date) errs.date = "Date is required";
    if (sales !== "" && isNaN(Number(sales))) errs.sales = "Must be a number";
    if (exp !== "" && isNaN(Number(exp))) errs.exp = "Must be a number";
    if (Number(sales) < 0) errs.sales = "Cannot be negative";
    if (Number(exp) < 0) errs.exp = "Cannot be negative";

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await upsertCashEntry({
        entry_date: date,
        cash_sales: Number(sales) || 0,
        supermarket_expenses: Number(exp) || 0,
        notes: notes.trim() || null,
      });
      toast.success(existing ? "Entry updated" : "Entry saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        action={
          existing ? (
            <Badge variant="gold">
              <CheckIcon size={12} /> Today logged
            </Badge>
          ) : null
        }
      >
        <CardTitle>Quick Entry</CardTitle>
        <CardDescription>
          Log cash sales and supermarket expenses for the selected day.
        </CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
          required
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Cash Sales"
          prefix="£"
          placeholder="0.00"
          value={sales}
          onChange={(e) => setSales(e.target.value)}
          error={errors.sales}
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Supermarket Expenses"
          prefix="£"
          placeholder="0.00"
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          error={errors.exp}
        />
        <Input
          label="Notes"
          placeholder="(optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={140}
        />

        <div className="rounded-xl bg-bg border border-border px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-text-muted">Day net</span>
          <span
            className={
              net >= 0
                ? "text-success font-semibold"
                : "text-danger font-semibold"
            }
          >
            {formatINR(net)}
          </span>
        </div>

        <Button type="submit" loading={submitting} className="w-full mt-1">
          {existing ? "Update Entry" : "Save Entry"}
        </Button>
      </form>
    </Card>
  );
}
