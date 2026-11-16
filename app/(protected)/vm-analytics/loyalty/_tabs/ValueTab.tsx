import { getLoyaltyOrderProfile } from "@/lib/vm-analytics/queries";
import { gbp, int, n, pct, truncTo } from "@/lib/vm-analytics/format";
import { LOYALTY_LAUNCH_WEEK } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { ChartCard, Section } from "@/components/vm-analytics/Section";
import { BarChartCard, LineChartCard } from "@/components/vm-analytics/charts/LazyCharts";
import type {
  LoyaltyMemberBaseRow,
  LoyaltyMemberSalesRow,
  LoyaltyPointsRow,
  LoyaltyRewardRow,
} from "@/lib/vm-analytics/types";
import {
  Caveat,
  InsightsMissing,
  Note,
  addDaysIso,
  chartPct,
  pickSnapshot,
  pointsDelta,
  share,
  shortWeek,
  splitByBucket,
} from "./shared";

const TREND_WEEKS = 12;
const HEADS_PER_CARD = 10;
// Value bands are ranked 1–7; rank 4 is £12–£13.99, the first band that earns a head.
const FIRST_EARNING_BAND = 4;

export async function ValueTab({
  storeKey,
  week,
  preLaunch,
  rewards,
  memberSales,
  points,
  memberBase,
}: {
  storeKey: string;
  week: string;
  preLaunch: boolean;
  rewards: LoyaltyRewardRow[];
  memberSales: LoyaltyMemberSalesRow[];
  points: LoyaltyPointsRow[];
  memberBase: LoyaltyMemberBaseRow[];
}) {
  const bandsResult = await getLoyaltyOrderProfile(storeKey, "value_band", addDaysIso(week, -21), week);

  const costOf = (iso: string) =>
    rewards.filter((r) => r.week_start_iso === iso).reduce((s, r) => s + n(r.reward_cost), 0);
  const rewardsMissing = !rewards.some((r) => r.week_start_iso === week);
  const rewardsThisWeek = rewards.filter((r) => r.week_start_iso === week);
  const cost = rewardsThisWeek.reduce((s, r) => s + n(r.reward_cost), 0);
  const rewardSales = rewardsThisWeek.reduce((s, r) => s + n(r.net_sales), 0);

  const msIdx = memberSales.findIndex((r) => r.week_start_iso === week);
  const ms = memberSales[msIdx];
  const prevMs = memberSales[msIdx - 1];
  const memberNet = ms && !preLaunch ? n(ms.member_net_sales) : null;
  const costPct = memberNet !== null && !rewardsMissing ? share(cost, memberNet) : null;
  const prevCostPct =
    prevMs && n(prevMs.member_net_sales) > 0 ? share(costOf(prevMs.week_start_iso), prevMs.member_net_sales) : null;
  const costPctNote = pointsDelta(costPct, prevCostPct) ?? "reward cost ÷ member net sales";

  const alphaToDate = rewards
    .filter((r) => r.reward_type === "alpha" && r.week_start_iso <= week)
    .reduce((s, r) => s + n(r.redemptions), 0);
  const unlockedToDate =
    points.filter((r) => r.week_start_iso <= week).reduce((s, r) => s + n(r.points_redeemed), 0) / HEADS_PER_CARD;
  const unclaimed = Math.max(0, unlockedToDate - alphaToDate);

  const snapshot = pickSnapshot(memberBase, week);

  const costTrend = memberSales
    .filter(
      (r) =>
        r.week_start_iso >= LOYALTY_LAUNCH_WEEK &&
        r.week_start_iso <= week &&
        n(r.member_net_sales) > 0 &&
        rewards.some((x) => x.week_start_iso === r.week_start_iso),
    )
    .slice(-TREND_WEEKS)
    .map((r) => ({
      week: shortWeek(r.week_start_iso),
      "Reward cost %": chartPct(share(costOf(r.week_start_iso), r.member_net_sales)),
    }));

  const bands = splitByBucket(bandsResult.rows);
  const memberTotal = bands.reduce((s, b) => s + b.member, 0);
  const nonMemberTotal = bands.reduce((s, b) => s + b.nonMember, 0);
  const bandChart = bands.map((b) => ({
    band: b.bucket,
    Members: chartPct(share(b.member, memberTotal)),
    "Non-members": chartPct(share(b.nonMember, nonMemberTotal)),
  }));
  const earning = (pick: (b: (typeof bands)[number]) => number, total: number) =>
    share(bands.filter((b) => b.rank >= FIRST_EARNING_BAND).reduce((s, b) => s + pick(b), 0), total);
  const memberEarning = earning((b) => b.member, memberTotal);
  const nonMemberEarning = earning((b) => b.nonMember, nonMemberTotal);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Does the scheme pay for itself?" description={`Reward cost against member sales, w/c ${shortWeek(week)}.`}>
        <KpiGrid>
          <KpiCard
            label="Reward cost"
            value={rewardsMissing ? "—" : gbp(cost)}
            hint={rewardsMissing ? "snapshot not refreshed" : "free items given, incl. sign-up & birthday"}
          />
          <KpiCard label="Member net sales" value={memberNet === null ? "—" : gbp(memberNet)} hint="all channels" />
          <KpiCard label="Reward cost % of member sales" value={costPct === null ? "—" : pct(costPct, 1)} hint={costPctNote} />
          <KpiCard
            label="Sales on reward orders"
            value={rewardsMissing ? "—" : gbp(rewardSales)}
            hint={
              rewardsMissing || cost <= 0
                ? "what else was bought with a free item"
                : `£${truncTo(rewardSales / cost, 2).toFixed(2)} of sales per £1 given`
            }
          />
          <KpiCard
            label="Unlocked meals not yet used"
            value={rewardsMissing ? "—" : int(unclaimed)}
            hint="unlocked to date − claimed to date"
          />
          <KpiCard
            label="Heads on members' cards"
            value={snapshot ? int(snapshot.points_liability_active) : "—"}
            hint={snapshot ? `engaged members · snapshot w/c ${shortWeek(snapshot.week_start_iso)}` : "no snapshot yet"}
          />
        </KpiGrid>
        <Caveat>
          Sales on reward orders counts an order once per reward on it. Unlocked meals not yet used includes any that expired
          after 30 days — the data can&apos;t tell the two apart. A full card still waiting to become a meal is on the
          Retention tab. Heads on cards counts members who have used the scheme
          and leaves out the dormant launch import.
        </Caveat>
      </Section>

      {costTrend.length > 1 && (
        <Section title="Reward cost trend" description={`Reward cost as a % of member net sales, last ${costTrend.length} weeks.`}>
          <ChartCard title="Reward cost % of member sales">
            <LineChartCard data={costTrend} xKey="week" lines={[{ key: "Reward cost %", name: "Reward cost %" }]} />
          </ChartCard>
        </Section>
      )}

      <Section
        title="Does the £12 rule lift spend?"
        description="In-store orders (kiosk + till) in the 4 weeks to the selected week, by amount paid. A head is earned on a day the member spends £12 or more."
      >
        {bandsResult.missing ? (
          <InsightsMissing />
        ) : memberTotal + nonMemberTotal === 0 ? (
          <Note>No in-store orders in these weeks.</Note>
        ) : (
          <>
            <ChartCard title="Share of each group's in-store orders (%)">
              <BarChartCard
                data={bandChart}
                xKey="band"
                bars={[
                  { key: "Members", name: "Members" },
                  { key: "Non-members", name: "Non-members" },
                ]}
              />
            </ChartCard>
            <Caveat>
              £12 or more: {memberEarning === null ? "—" : pct(memberEarning, 1)} of member orders against{" "}
              {nonMemberEarning === null ? "—" : pct(nonMemberEarning, 1)} of non-member orders ({int(memberTotal)} member and{" "}
              {int(nonMemberTotal)} non-member orders). In store only, because delivery-app customers can never be members
              and every Peckers-app order is one.
            </Caveat>
          </>
        )}
      </Section>
    </div>
  );
}
