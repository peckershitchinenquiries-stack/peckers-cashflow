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
}: {
  line: {
    short_deliveries_count?: number | null;
    long_deliveries_count?: number | null;
    short_misc_count?: number | null;
    long_misc_count?: number | null;
  };
  /** Renders as a footer total row (bolder, no "—" placeholder). */
  total?: boolean;
}) {
  const d = deliveryBreakdown(line);
  if (d.total === 0 && !total) return <>—</>;

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
