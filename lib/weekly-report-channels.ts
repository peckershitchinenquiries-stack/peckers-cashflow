// =============================================================
// The "Sale by Channel" history for the weekly report workbook.
//
// Two sources, one series: VM's gross per-channel ingest for every week it
// holds, and the stores' own typed history (migration 058) for the weeks
// before it. VM wins wherever both have a week — it is the till, the typed
// rows were someone copying it.
//
// A plain module, not "use server": every export there is a callable endpoint.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreGrossChannelWeeks } from "./vm-analytics/queries";
import { num, round2 } from "./weekly-report";

/** The workbook's channel columns, in its order, keyed by VM's channel names. */
export const CHANNEL_COLUMNS = [
  { vm: "Click & Collect", column: "click_collect" },
  { vm: "Deliveroo", column: "deliveroo" },
  { vm: "Just Eat", column: "just_eat" },
  { vm: "Kiosk", column: "kiosk" },
  { vm: "Own Delivery", column: "own_delivery" },
  { vm: "Uber Eats", column: "uber_eats" },
  { vm: "Till (eat-in)", column: "till_eat_in" },
  { vm: "Till (takeaway)", column: "till_takeaway" },
] as const;

export type ChannelWeek = {
  week_start: string;
  /** In CHANNEL_COLUMNS order; null = nothing recorded for that channel. */
  sales: (number | null)[];
  /** Only the typed history carries one; VM weeks derive it from 52 weeks back. */
  typed_last_year: number | null;
};

export async function loadChannelHistory(
  supabase: SupabaseClient,
  storeId: string,
  vmStoreName: string | null,
  throughWeekIso: string,
): Promise<{ weeks: ChannelWeek[]; error: string | null }> {
  const [historyRes, vmWeeks] = await Promise.all([
    supabase
      .from("weekly_report_channel_history")
      .select("*")
      .eq("store_id", storeId)
      .lte("week_start", throughWeekIso)
      .order("week_start"),
    vmStoreName
      ? getStoreGrossChannelWeeks(vmStoreName, throughWeekIso).catch((e: Error) => e)
      : Promise.resolve(new Map<string, Map<string, number>>()),
  ]);

  const byWeek = new Map<string, ChannelWeek>();
  for (const row of (historyRes.data ?? []) as Record<string, unknown>[]) {
    const week = String(row.week_start);
    byWeek.set(week, {
      week_start: week,
      sales: CHANNEL_COLUMNS.map((c) => (row[c.column] == null ? null : num(row[c.column]))),
      typed_last_year: row.last_year_sales == null ? null : num(row.last_year_sales),
    });
  }

  if (!(vmWeeks instanceof Error)) {
    for (const [week, channels] of vmWeeks) {
      byWeek.set(week, {
        week_start: week,
        sales: CHANNEL_COLUMNS.map((c) =>
          channels.has(c.vm) ? round2(channels.get(c.vm)!) : null,
        ),
        typed_last_year: null,
      });
    }
  }

  return {
    weeks: Array.from(byWeek.values()).sort((a, b) => a.week_start.localeCompare(b.week_start)),
    error:
      historyRes.error?.message ??
      (vmWeeks instanceof Error ? vmWeeks.message : null),
  };
}
