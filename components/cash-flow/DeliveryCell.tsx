"use client";

import * as React from "react";
import { deliveryBreakdown } from "@/lib/utils";

/**
 * One payout line's deliveries in a single column: the total, with the
 * breakdown under it in short form —
 *
 *     47
 *     24 SD · 23 LD · 0 SM · 0 LM
 *
 * SD/LD are the normal round, SM/LM the miscellaneous (extra) drops. All four
 * are always printed, zeros included, so a manager can see at a glance that
 * misc was checked rather than missing. Non-zero misc is highlighted.
 */
export function DeliveryCell({
  line,
  total,
  stacked,
}: {
  line: {
    short_deliveries_count?: number | null;
    long_deliveries_count?: number | null;
    short_misc_count?: number | null;
    long_misc_count?: number | null;
  };
  /** Renders as a footer total row (bolder, no "—" placeholder). */
  total?: boolean;
  /** Narrow phone cards: splits the breakdown over two lines so it can't overflow. */
  stacked?: boolean;
}) {
  const d = deliveryBreakdown(line);
  if (d.total === 0 && !total) return <>—</>;

  if (stacked) {
    return (
      <>
        <span className={total ? "" : "font-medium"}>{d.total}</span>
        <span className="block text-[10px] text-text-muted font-normal">
          {d.sd} SD · {d.ld} LD
        </span>
        <span className="block text-[10px] text-text-muted font-normal">
          <span className={d.sm > 0 ? "text-gold font-medium" : ""}>{d.sm} SM</span> ·{" "}
          <span className={d.lm > 0 ? "text-gold font-medium" : ""}>{d.lm} LM</span>
        </span>
      </>
    );
  }

  return (
    <>
      <span className={total ? "" : "font-medium"}>{d.total}</span>
      <span className="block text-[10px] text-text-muted whitespace-nowrap font-normal">
        {d.sd} SD · {d.ld} LD ·{" "}
        <span className={d.sm > 0 ? "text-gold font-medium" : ""}>{d.sm} SM</span> ·{" "}
        <span className={d.lm > 0 ? "text-gold font-medium" : ""}>{d.lm} LM</span>
      </span>
    </>
  );
}
