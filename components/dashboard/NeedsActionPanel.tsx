import * as React from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { NeedsActionData } from "@/lib/dashboard/types";
import { ddmm } from "./format";

type Item = { key: string; text: string; detail?: string; href: string; tone: "danger" | "warning" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const dateList = (dates: string[]) =>
  dates.length > 6
    ? `${dates.slice(0, 6).map(ddmm).join(", ")} +${dates.length - 6} more`
    : dates.map(ddmm).join(", ");

function items(d: NeedsActionData): Item[] {
  const out: Item[] = [];
  if (d.unpaidOnConfirmedSheet > 0) {
    out.push({
      key: "unpaid",
      text: `${plural(d.unpaidOnConfirmedSheet, "unapproved day")} in a confirmed pay week`,
      detail: "These won't be paid on that sheet.",
      href: "/employees",
      tone: "danger",
    });
  }
  if (d.unapprovedDays) {
    out.push({
      key: "approval",
      text: `${plural(d.unapprovedDays, "day")} waiting for approval`,
      detail: `Since ${ddmm(d.approvalSince)}`,
      href: "/employees",
      tone: "warning",
    });
  }
  if (d.missingCashDates?.length) {
    out.push({
      key: "cash",
      text: `${d.missingCashDates.length} cash ${d.missingCashDates.length === 1 ? "entry" : "entries"} missing`,
      detail: dateList(d.missingCashDates),
      href: "/cash-flow/daily",
      tone: "warning",
    });
  }
  if (d.changedEnvelopeDates?.length) {
    out.push({
      key: "envelope",
      text: `${plural(d.changedEnvelopeDates.length, "envelope")} changed by manager`,
      detail: dateList(d.changedEnvelopeDates),
      href: "/cash-flow/daily",
      tone: "warning",
    });
  }
  if (d.reportNotLocked) {
    out.push({
      key: "report",
      text: "Last week's weekly report not locked",
      href: d.reportHref,
      tone: "warning",
    });
  }
  if (d.labourOverPts !== null) {
    out.push({
      key: "labour",
      text: `Labour ${d.labourOverPts.toFixed(1)} pts over budget`,
      detail: "Last week",
      href: d.labourHref,
      tone: "danger",
    });
  }
  if (d.openAlerts) {
    out.push({
      key: "alerts",
      text: plural(d.openAlerts, "open alert"),
      href: "/alerts",
      tone: "warning",
    });
  }
  return out;
}

export function NeedsActionPanel({ data }: { data: NeedsActionData }) {
  const list = items(data);

  return (
    <Card className="max-sm:p-3.5 lg:h-full">
      <h3 className="text-base font-semibold tracking-wide text-text-primary mb-3">Needs action</h3>

      {data.errors.length > 0 && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-medium">Some checks couldn&apos;t run, so this list is incomplete:</p>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {data.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {list.length === 0 ? (
        data.errors.length === 0 && (
          <p className="py-4 text-center text-sm font-medium text-success">All clear ✓</p>
        )
      ) : (
        <ul className="divide-y divide-border">
          {list.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                className="flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                    item.tone === "danger" ? "bg-danger" : "bg-warning",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">{item.text}</span>
                  {item.detail && (
                    <span className="block text-xs text-text-muted break-words">{item.detail}</span>
                  )}
                </span>
                <span className="text-text-muted" aria-hidden>
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
