import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { formatGBP } from "@/lib/utils";
import type { EmployeeHoursComputed } from "@/lib/types";

export const dynamic = "force-dynamic";

// NI is paid monthly (via PAYE) while cash is paid weekly. This page aggregates
// the NI portion (first 20h/week) of approved hours into calendar-month totals
// per employee, so owners can reconcile the monthly PAYE run. A week is
// attributed to the month of its Monday (week_start_date).
function monthKey(weekStart: string): string {
  return weekStart.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

type EmpMonth = {
  employee_name: string;
  ni_hours: number;
  ni_wages: number;
  cash_wages: number;
};

export default async function NiMonthlyPage() {
  await requireRole(["admin"]);
  const supabase = createServerSupabase();

  const { data } = await supabase
    .from("employee_hours_computed")
    .select("*")
    .eq("approved", true)
    .order("week_start_date", { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as EmployeeHoursComputed[];

  // month -> employee -> totals
  const byMonth = new Map<string, Map<string, EmpMonth>>();
  for (const r of rows) {
    const key = monthKey(r.week_start_date);
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    const empMap = byMonth.get(key)!;
    const niHours = Number(r.bank_hours) || 0;
    const niWages = niHours * (Number(r.hourly_rate_snapshot) || 0);
    const existing = empMap.get(r.employee_id) ?? {
      employee_name: r.employee_name,
      ni_hours: 0,
      ni_wages: 0,
      cash_wages: 0,
    };
    existing.ni_hours += niHours;
    existing.ni_wages += niWages;
    existing.cash_wages += Number(r.cash_amount_due) || 0;
    empMap.set(r.employee_id, existing);
  }

  const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <PageHeader
        title="NI — Monthly Summary"
        description="National Insurance (PAYE) wages grouped by calendar month. NI is paid monthly; cash is paid weekly on the Saturday payout."
      />

      {months.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No approved hours yet. Approve clocked hours on the Employees page and
            they will appear here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {months.map((mk) => {
            const emps = Array.from(byMonth.get(mk)!.values()).sort((a, b) =>
              a.employee_name.localeCompare(b.employee_name),
            );
            const niTotal = emps.reduce((s, e) => s + e.ni_wages, 0);
            const cashTotal = emps.reduce((s, e) => s + e.cash_wages, 0);
            return (
              <Card key={mk} className="p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold text-text-primary">{monthLabel(mk)}</h2>
                  <div className="text-right">
                    <p className="text-xs text-text-muted">NI (PAYE) total</p>
                    <p className="text-lg font-semibold text-gold tabular-nums">{formatGBP(niTotal)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-text-muted bg-bg/50">
                        <th className="px-4 py-2.5 font-medium">Employee</th>
                        <th className="px-4 py-2.5 font-medium text-right">NI hours</th>
                        <th className="px-4 py-2.5 font-medium text-right">NI wages (PAYE)</th>
                        <th className="px-4 py-2.5 font-medium text-right">Cash (weekly)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emps.map((e, i) => (
                        <tr key={e.employee_name} className={`${i % 2 === 0 ? "" : "bg-bg/40"} border-t border-border/60`}>
                          <td className="px-4 py-2.5 font-medium">{e.employee_name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{e.ni_hours.toFixed(1)}h</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{formatGBP(e.ni_wages)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{formatGBP(e.cash_wages)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-bg/60 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {emps.reduce((s, e) => s + e.ni_hours, 0).toFixed(1)}h
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gold">{formatGBP(niTotal)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{formatGBP(cashTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
