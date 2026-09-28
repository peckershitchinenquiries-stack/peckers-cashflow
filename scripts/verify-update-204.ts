// Acceptance test for Update 204 — the Labour Cost dashboard and the Weekly
// Report's Summary must quote ONE labour figure and ONE percentage.
//
// Checks, for every store with a report in the week:
//   1. the dashboard's total_cost equals the report's labourTotal
//   2. both percentages are cost / NET sales, to 2dp
//   npx tsx -r ./scripts/_script-env.cjs scripts/verify-update-204.ts [week]
import { getLabourByStoreWeek, getWeeklyReportLabour } from "../lib/vm-analytics/labour";
import { getExec } from "../lib/vm-analytics/queries";
import { calculateLabour } from "../lib/vm-analytics/weekly-summary";
import { getCashflowSupabaseServer } from "../lib/supabase-cashflow";

const week = process.argv[2] ?? "2026-09-21";

async function main() {
  const sb = getCashflowSupabaseServer();
  const { data: stores } = await sb.from("stores").select("id, name, vm_store_name");
  const { rows, load_error } = await getLabourByStoreWeek([week]);
  if (load_error) throw new Error(load_error);
  const reports = await getWeeklyReportLabour([week]);
  const exec = await getExec(week);

  let failures = 0;
  for (const store of stores ?? []) {
    const row = rows.find((r) => r.store_id === store.id);
    if (!row) continue;
    const rep = reports.get(`${store.id}|${week}`);
    const vmNet = Number(exec.find((c) => c.store === store.vm_store_name)?.net_sales ?? 0);
    // The Summary tab's own Labour row, computed the way the sheet computes it.
    const sheetLabour = calculateLabour(vmNet, {
      labour_cost: rep?.labour_cost ?? 0,
      labour_budget_pct: (rep?.budget_pct ?? 0) / 100,
    });

    console.log(`\n── ${store.name} · week of ${week}`);
    console.log(`   VM net sales             : ${vmNet.toFixed(2)}`);
    console.log(`   dashboard net_sales      : ${row.net_sales?.toFixed(2) ?? "—"}`);
    console.log(`   dashboard labour cost    : ${row.total_cost.toFixed(2)} (${row.cost_source})`);
    console.log(`   approved-hours cost      : ${row.derived_cost.toFixed(2)}`);
    console.log(`   report labourTotal       : ${rep?.labour_cost?.toFixed(2) ?? "—"}`);
    console.log(`   dashboard labour %       : ${row.labour_pct?.toFixed(2) ?? "—"}`);
    console.log(
      `   sheet Labour £ / %       : ${sheetLabour.actual?.toFixed(2) ?? "—"} / ${
        sheetLabour.actual_pct != null ? (sheetLabour.actual_pct * 100).toFixed(2) : "—"
      } (budget ${(rep?.budget_pct ?? 0).toFixed(2)}%)`,
    );

    if (rep?.labour_cost == null) {
      console.log("   → no report labour lines; dashboard prices approved hours. OK");
      continue;
    }
    const costOk = Math.abs(row.total_cost - rep.labour_cost) < 0.01;
    const sheetPct = sheetLabour.actual_pct != null ? sheetLabour.actual_pct * 100 : null;
    const pctOk =
      row.labour_pct != null && sheetPct != null && Math.abs(row.labour_pct - sheetPct) < 0.02;
    console.log(`   → cost match: ${costOk ? "PASS" : "FAIL"} · % match: ${pctOk ? "PASS" : "FAIL"}`);
    if (!costOk || !pctOk) failures++;
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} store(s) FAILED`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
