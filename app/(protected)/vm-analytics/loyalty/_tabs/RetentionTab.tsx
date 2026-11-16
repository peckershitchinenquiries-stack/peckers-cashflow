import {
  getLoyaltyActivation,
  getLoyaltyActivity,
  getLoyaltyCohorts,
  getLoyaltyWinback,
} from "@/lib/vm-analytics/queries";
import { int, n, pct, truncTo } from "@/lib/vm-analytics/format";
import { LOYALTY_LAUNCH_WEEK } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { ChartCard, Section } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { LineChartCard } from "@/components/vm-analytics/charts/LazyCharts";
import type { LoyaltyActivationRow, LoyaltyCohortRow, LoyaltyMemberSalesRow } from "@/lib/vm-analytics/types";
import { Caveat, InsightsMissing, Note, ShareBar, chartPct, pickSnapshot, pointsDelta, share, shortWeek } from "./shared";

const TREND_WEEKS = 12;
const ACTIVATION_WEEKS = 8;

interface FrequencyLine {
  label: string;
  members: number;
  share: number | null;
}

function cohortCell(back: unknown, eligible: unknown) {
  const s = share(back, eligible);
  return s === null ? <span className="text-tertiary">—</span> : pct(s, 1);
}

export async function RetentionTab({
  storeKey,
  week,
  memberSales,
  preLaunch,
}: {
  storeKey: string;
  week: string;
  memberSales: LoyaltyMemberSalesRow[];
  preLaunch: boolean;
}) {
  const [activity, cohorts, activation, winback] = await Promise.all([
    getLoyaltyActivity(storeKey),
    getLoyaltyCohorts(storeKey),
    getLoyaltyActivation(storeKey),
    getLoyaltyWinback(storeKey),
  ]);

  const msIdx = memberSales.findIndex((r) => r.week_start_iso === week);
  const ms = memberSales[msIdx];
  const prevMs = memberSales[msIdx - 1];
  const repeat = ms && !preLaunch && n(ms.member_customers) > 0 ? 100 * n(ms.member_repeat_rate) : null;
  const prevRepeat = prevMs && n(prevMs.member_customers) > 0 ? 100 * n(prevMs.member_repeat_rate) : null;

  const act = activity.rows.find((r) => r.week_start_iso === week);
  const visitsPerActive = act && n(act.active_4w) > 0 ? n(act.visits_4w) / n(act.active_4w) : null;

  const wb = pickSnapshot(winback.rows, week);
  const wbNote = wb && wb.week_start_iso !== week ? ` · snapshot w/c ${shortWeek(wb.week_start_iso)}` : "";

  const repeatTrend = memberSales
    .filter((r) => r.week_start_iso >= LOYALTY_LAUNCH_WEEK && r.week_start_iso <= week && n(r.member_customers) > 0)
    .slice(-TREND_WEEKS)
    .map((r) => ({ week: shortWeek(r.week_start_iso), "Repeat rate %": chartPct(100 * n(r.member_repeat_rate)) }));

  const frequencyBands: Array<[string, number]> = act
    ? [
        ["1 visit", n(act.freq_1)],
        ["2 visits", n(act.freq_2)],
        ["3 visits", n(act.freq_3)],
        ["4 or more", n(act.freq_4plus)],
      ]
    : [];
  const frequency: FrequencyLine[] = frequencyBands.map(([label, members]) => ({
    label,
    members,
    share: share(members, act?.active_4w),
  }));
  const frequencyColumns: Column<FrequencyLine>[] = [
    { key: "label", header: "Visits in the last 4 weeks", render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "members", header: "Members", align: "right", render: (r) => int(r.members) },
    {
      key: "share",
      header: "Share",
      align: "right",
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <ShareBar value={r.share} />
          {r.share === null ? "—" : pct(r.share, 1)}
        </span>
      ),
    },
  ];

  const cohortColumns: Column<LoyaltyCohortRow>[] = [
    { key: "month", header: "First visit", render: (r) => <span className="font-medium">{r.cohort_label}</span> },
    { key: "members", header: "Members", align: "right", render: (r) => int(r.members) },
    { key: "w2", header: "Back in 2 wks", align: "right", render: (r) => cohortCell(r.back_2w, r.eligible_2w) },
    { key: "w4", header: "4 wks", align: "right", render: (r) => cohortCell(r.back_4w, r.eligible_4w) },
    { key: "w8", header: "8 wks", align: "right", render: (r) => cohortCell(r.back_8w, r.eligible_8w) },
    { key: "w12", header: "12 wks", align: "right", render: (r) => cohortCell(r.back_12w, r.eligible_12w) },
    { key: "ever", header: "Back so far", align: "right", render: (r) => cohortCell(r.back_ever, r.members) },
  ];

  const activationRows = activation.rows
    .filter((r) => r.week_start_iso <= week && r.week_start_iso >= LOYALTY_LAUNCH_WEEK)
    .slice(-ACTIVATION_WEEKS)
    .reverse();
  const activationColumns: Column<LoyaltyActivationRow>[] = [
    { key: "week", header: "Signed up w/c", render: (r) => <span className="font-medium">{shortWeek(r.week_start_iso)}</span> },
    { key: "signups", header: "Sign-ups", align: "right", render: (r) => int(r.signups) },
    { key: "same", header: "Visited same week", align: "right", render: (r) => int(r.visited_same_week) },
    { key: "w4", header: "Within 4 weeks", align: "right", render: (r) => int(r.visited_4w) },
    {
      key: "rate",
      header: "% within 4 weeks",
      align: "right",
      render: (r) => {
        const s = share(r.visited_4w, r.signups);
        if (s === null) return "—";
        return r.window_4w_complete ? pct(s, 1) : <span title="The 4 weeks aren't over yet">{pct(s, 1)} so far</span>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Section title="Are they coming back?" description="Repeat behaviour for the selected week and the 4 weeks to it.">
        <KpiGrid>
          <KpiCard
            label="Repeat rate"
            value={repeat === null ? "—" : pct(repeat, 1)}
            hint={pointsDelta(repeat, prevRepeat) ?? "members this week who had ordered before"}
          />
          <KpiCard
            label="Visiting members (4 weeks)"
            value={act ? int(act.active_4w) : "—"}
            hint={activity.missing ? "run the insights SQL" : "earned a head from an order in the last 4 weeks"}
          />
          <KpiCard
            label="Visits per active member"
            value={visitsPerActive === null ? "—" : truncTo(visitsPerActive, 2).toFixed(2)}
            hint="last 4 weeks"
          />
          <KpiCard
            label="Win-back: close to a free meal"
            value={wb ? int(wb.near_reward_quiet) : "—"}
            hint={wb ? `of ${int(wb.near_reward)} on 7–9 heads, quiet 3+ weeks${wbNote}` : "run the insights SQL"}
          />
          <KpiCard
            label="Full cards (10 heads)"
            value={wb ? int(wb.meal_ready) : "—"}
            hint={wb ? `not yet a meal · ${int(wb.meal_ready_quiet)} quiet 3+ weeks${wbNote}` : "run the insights SQL"}
          />
        </KpiGrid>
        <Caveat>
          Repeat rate = members who ordered this week and had already placed a member order in an earlier week. Peckers-app
          orders always count as member orders.
        </Caveat>
      </Section>

      {repeatTrend.length > 1 && (
        <Section title="Repeat rate trend" description={`Last ${repeatTrend.length} weeks to w/c ${shortWeek(week)}.`}>
          <ChartCard title="Repeat rate (%)">
            <LineChartCard data={repeatTrend} xKey="week" lines={[{ key: "Repeat rate %", name: "Repeat rate %" }]} />
          </ChartCard>
        </Section>
      )}

      <Section title="How often visiting members come in" description="Members with at least one visit in the 4 weeks to the selected week.">
        {activity.missing ? (
          <InsightsMissing />
        ) : !act ? (
          <Note>No visits before launch.</Note>
        ) : (
          <DataTable columns={frequencyColumns} rows={frequency} />
        )}
      </Section>

      <Section
        title="Cohort retention"
        description="Members grouped by the month of their first visit: the share who visited again within 2, 4, 8 and 12 weeks."
      >
        {cohorts.missing ? (
          <InsightsMissing />
        ) : (
          <>
            <DataTable columns={cohortColumns} rows={cohorts.rows} emptyMessage="No visits yet." />
            <Caveat>
              Data to the latest synced week, not the selected one. &ldquo;—&rdquo; means not enough time has passed yet; a
              partly elapsed window counts only members whose full window is in the data. &ldquo;Back so far&rdquo; counts
              every member in the cohort, including those who joined only days ago, so it can read below a window figure.
            </Caveat>
          </>
        )}
      </Section>

      <Section title="Do new sign-ups turn into customers?" description="New accounts and whether they went on to earn a head from an order.">
        {activation.missing ? (
          <InsightsMissing />
        ) : (
          <>
            <DataTable columns={activationColumns} rows={activationRows} emptyMessage="No sign-ups since launch." />
            <Caveat>
              Hitchin&apos;s launch weeks (13 Apr – 17 May 2026) carry 588–815 sign-ups a week that VM has not explained
              yet, so compare recent weeks with each other rather than with launch.
            </Caveat>
          </>
        )}
      </Section>
    </div>
  );
}
