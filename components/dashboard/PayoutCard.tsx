import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatGBP } from "@/lib/utils";
import type { PayoutCardData } from "@/lib/dashboard/types";
import { ddmm } from "./format";

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="py-2 border-t border-border first:border-t-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text-subtle">{label}</span>
        <span className="font-medium tabular-nums text-text-primary whitespace-nowrap">{value}</span>
      </div>
      {note && <p className="mt-0.5 text-xs text-text-muted tabular-nums break-words">{note}</p>}
    </div>
  );
}

function Hero({
  label,
  value,
  className,
  compact,
}: {
  label: string;
  value: string;
  className: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-hover/40 p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.18em] text-text-muted font-medium">
        {label}
      </p>
      <p className={`${compact ? "text-lg" : "text-xl"} sm:text-2xl font-semibold mt-1 tabular-nums whitespace-nowrap ${className}`}>
        {value}
      </p>
    </div>
  );
}

export function PayoutCard({
  data,
  kind,
  today,
}: {
  data: PayoutCardData;
  kind: "this" | "next";
  today: string;
}) {
  const f = data.figures;
  const dayLabel =
    kind === "this"
      ? today === data.payday
        ? "Today"
        : today === data.weekStart
          ? "Tomorrow"
          : null
      : null;

  return (
    <Card className="max-sm:p-3.5 flex flex-col h-full">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-wide text-text-primary">
            {kind === "this" ? "This Tuesday" : "Next Tuesday"} · {ddmm(data.payday)}
            {dayLabel && <Badge variant="gold">{dayLabel}</Badge>}
            {kind === "next" && <Badge>Forecast</Badge>}
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Pays work {ddmm(data.payWeek.start)} – {ddmm(data.payWeek.end)}
          </p>
        </div>
        {data.state === "confirmed" ? (
          <Badge variant="success">
            Confirmed ✓{data.confirmedByName ? ` by ${data.confirmedByName}` : ""}
          </Badge>
        ) : data.state === "draft" ? (
          <Badge variant="warning">Draft</Badge>
        ) : (
          <Badge>Not generated</Badge>
        )}
      </div>

      {data.loadError || !f ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Couldn&apos;t load this payout ({data.loadError ?? "no figures"}). Open the payout sheet
          before relying on any figure for this week.
        </p>
      ) : kind === "this" ? (
        <>
          {f.postOfficeDraw > 0 ? (
            <Hero label="Post Office draw" value={formatGBP(f.postOfficeDraw)} className="text-danger" />
          ) : f.surplus > 0 ? (
            <Hero label="Surplus" value={formatGBP(f.surplus)} className="text-success" />
          ) : (
            <Hero label="Post Office draw" value="Break-even" className="text-text-primary" />
          )}

          <div className="mt-3">
            <Row
              label="Actual cash available"
              value={formatGBP(f.cashAvailable)}
              note={`${formatGBP(f.openingBalance)} carried fwd + ${formatGBP(f.cashCollected)} envelopes + ${formatGBP(f.supermarketFloat)} float`}
            />
            <Row
              label="Wages"
              value={formatGBP(f.wages)}
              note={`${formatGBP(f.cashWages)} cash + ${formatGBP(f.deliveryWages)} delivery`}
            />
          </div>

          {data.state !== "confirmed" && (
            <p className="mt-3 text-xs text-text-muted">
              Figures rise as days are approved and envelopes are logged.
            </p>
          )}
        </>
      ) : (
        // The week is still being worked, so only what has actually landed so far is shown.
        <>
          <div className="grid grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 gap-2 sm:gap-3">
            <Hero label="Cash in envelopes" value={formatGBP(f.cashCollected)} className="text-gold" compact />
            <Hero label="Wages" value={formatGBP(f.wages)} className="text-text-primary" compact />
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Till now — rises as envelopes are logged and days are approved.
          </p>
        </>
      )}

      <a
        href={data.href}
        className="mt-auto pt-3 text-sm font-medium text-gold hover:underline underline-offset-2"
      >
        Open payout sheet →
      </a>
    </Card>
  );
}
