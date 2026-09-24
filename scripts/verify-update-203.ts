// Throwaway acceptance test for Update 203 — the new labour aggregator must
// agree to the penny with the Weekly Report's labour total for the same
// store-week, since both are NI + cash + delivery over the same approved hours.
//
// It is compared against a FRESH replication of prefillLabour's payload (the
// reference implementation, copied verbatim and read-only), not against the
// saved report rows: a draft's rows are what a manager has since corrected, and
// carry `adhoc` lines for people with no clock record at all. Saved totals are
// printed alongside for context.
//   npx tsx scripts/verify-update-203.ts
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function weekEndOf(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { getLabourByStoreWeek } = await import("../lib/vm-analytics/labour");
  const { labourTotal, round2, round4 } = await import("../lib/weekly-report");
  const cf = await import("../lib/cash-flow");

  /** prefillLabour's payload, rebuilt read-only for one store-week. */
  async function freshPrefill(storeId: string, weekStart: string) {
    const weekEnd = weekEndOf(weekStart);
    const [employeesRes, clocksRes, coverRes, managersRes, managerClocksRes] =
      await Promise.all([
        sb.from("employees").select("*"),
        sb
          .from("clock_events")
          .select("*")
          .gte("event_date", weekStart)
          .lte("event_date", weekEnd),
        sb
          .from("cover_driver_hours_computed")
          .select("*")
          .eq("store_id", storeId)
          .eq("approved", true)
          .gte("work_date", weekStart)
          .lte("work_date", weekEnd),
        sb
          .from("allowed_users")
          .select(
            "id, name, fixed_daily_wage, short_delivery_rate, long_delivery_rate, extra_short_delivery_rate, extra_long_delivery_rate",
          )
          .eq("role", "manager"),
        sb
          .from("manager_clock_events")
          .select("*")
          .eq("store_id", storeId)
          .gte("event_date", weekStart)
          .lte("event_date", weekEnd),
      ]);

    const employees = (employeesRes.data ?? []) as never[];
    const clocks = (clocksRes.data ?? []) as never[];
    const payload: Record<string, number>[] = [];

    const cashLines = new Map(
      cf.buildWageLinesForStore(storeId, employees, clocks).map((l) => [l.employee_id, l]),
    );

    for (const emp of employees as Array<Record<string, never>>) {
      const e = emp as unknown as {
        id: string;
        hourly_ni_rate: number | null;
        hourly_rate: number;
        hourly_cash_rate: number | null;
      };
      const hoursAtStore = round2(
        (clocks as unknown as Array<Record<string, unknown>>)
          .filter(
            (c) => c.employee_id === e.id && c.store_id === storeId && c.clock_in_at,
          )
          .reduce((t, c) => t + (Number(c.approved_hours) || 0), 0),
      );
      const wage = cashLines.get(e.id);
      if (hoursAtStore <= 0 && !wage) continue;
      const cashHours = wage
        ? Number(wage.cash_hours) || 0
        : round2(cashHoursFrom(hoursAtStore, storeId, emp as never));
      const niHours = round2(Math.max(0, hoursAtStore - cashHours));
      payload.push({
        ni_hours: niHours,
        ni_rate: e.hourly_ni_rate != null ? Number(e.hourly_ni_rate) : Number(e.hourly_rate) || 0,
        cash_hours: cashHours,
        cash_rate: wage ? Number(wage.cash_rate) || 0 : Number(e.hourly_cash_rate) || 0,
        delivery_pay: wage ? Number(wage.delivery_wages) || 0 : 0,
      });
    }

    // The report flattens a cover driver's week to hours x ONE rate; the
    // aggregator (like the payout) sums the money per approved DAY. They differ
    // only when a rate changed mid-week, so the gap is reported, not hidden.
    let coverFlatten = 0;
    for (const line of cf.buildCoverDriverWageLines(storeId, (coverRes.data ?? []) as never[])) {
      coverFlatten +=
        round2((Number(line.cash_hours) || 0) * (Number(line.cash_rate) || 0)) -
        (Number(line.cash_wage) || 0);
      payload.push({
        ni_hours: 0,
        ni_rate: 0,
        cash_hours: Number(line.cash_hours) || 0,
        cash_rate: Number(line.cash_rate) || 0,
        delivery_pay: Number(line.delivery_wages) || 0,
      });
    }

    const managerDays = new Map<string, { days: number; hours: number }>();
    for (const d of (managerClocksRes.data ?? []) as Array<Record<string, unknown>>) {
      if (!d.clock_in_at) continue;
      const acc = managerDays.get(d.manager_id as string) ?? { days: 0, hours: 0 };
      acc.days += 1;
      acc.hours += Number(d.worked_hours) || 0;
      managerDays.set(d.manager_id as string, acc);
    }
    const managers = (managersRes.data ?? []) as Array<{
      id: string;
      fixed_daily_wage: number | null;
    }>;
    const managerDelivery = new Map(
      cf
        .buildManagerWageLines(storeId, managers as never[], (managerClocksRes.data ?? []) as never[])
        .map((l) => [l.manager_id!, l]),
    );
    for (const mgr of managers) {
      const worked = managerDays.get(mgr.id);
      const delivery = managerDelivery.get(mgr.id);
      if (!worked && !delivery) continue;
      const hours = worked ? round2(worked.hours) : 0;
      const wage = worked ? round2(worked.days * (Number(mgr.fixed_daily_wage) || 0)) : 0;
      payload.push({
        ni_hours: hours,
        ni_rate: hours > 0 ? round4(wage / hours) : 0,
        cash_hours: 0,
        cash_rate: 0,
        delivery_pay: delivery ? Number(delivery.delivery_wages) || 0 : 0,
      });
    }
    return { total: labourTotal(payload as never), coverFlatten: round2(coverFlatten) };
  }

  function cashHoursFrom(h: number, storeId: string, emp: never) {
    return cf.cashHoursFromStoreTotal(h, storeId, emp);
  }

  const { data: reports } = await sb
    .from("weekly_reports")
    .select("id, store_id, week_start, status")
    .order("week_start", { ascending: false })
    .limit(30);
  const { data: stores } = await sb.from("stores").select("id, name");
  const storeName = (id: string) => stores?.find((s) => s.id === id)?.name ?? id;

  let compared = 0;
  let failures = 0;
  for (const r of reports ?? []) {
    const { data: lines } = await sb
      .from("weekly_report_labour_lines")
      .select("*")
      .eq("report_id", r.id);
    if (!lines || lines.length === 0) continue;

    const savedTotal = labourTotal(lines as never);
    const fresh = await freshPrefill(r.store_id, r.week_start);
    const { rows } = await getLabourByStoreWeek([r.week_start]);
    const row = rows.find((x) => x.store_id === r.store_id);
    if (!row) continue;

    const delta = Math.round((row.total_cost - fresh.total + fresh.coverFlatten) * 100) / 100;
    if (delta !== 0) failures++;
    console.log(
      `${delta === 0 ? "PASS" : "FAIL"}  ${storeName(r.store_id)}  week ${r.week_start} (${r.status})` +
        `\n      prefillLabour total (fresh) : ${fresh.total.toFixed(2)}` +
        `\n      aggregator total_cost       : ${row.total_cost.toFixed(2)}`+
        `
      cover-driver flattening     : ${fresh.coverFlatten.toFixed(2)}  (report: hours x one rate; aggregator: summed per approved day, as the payout does)`+
        `
      residual delta              : ${delta.toFixed(2)}` +
        `\n      saved report rows (edited)  : ${savedTotal.toFixed(2)}` +
        `\n      ni ${row.ni_cost.toFixed(2)}/${row.ni_hours}h · cash ${row.cash_cost.toFixed(2)}/${row.cash_hours}h` +
        ` · delivery ${row.delivery_cost.toFixed(2)}/${row.deliveries} drops · mgr ${row.manager_cost.toFixed(2)}/${row.manager_days}d` +
        ` · cover ${row.cover_driver_cost.toFixed(2)}/${row.cover_driver_hours}h` +
        `\n      rota ${row.rota_hours}h · approved ${row.total_hours}h · unapproved_days ${row.unapproved_days}`,
    );
    compared++;
    if (compared >= 4) break;
  }
  console.log(`\n${compared} store-weeks compared, ${failures} mismatched.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
