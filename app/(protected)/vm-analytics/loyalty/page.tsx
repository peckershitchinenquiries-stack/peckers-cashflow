import {
  getWeeks,
  getLoyaltySignups,
  getLoyaltyPoints,
  getLoyaltyPointsChannel,
  getLoyaltyRewards,
  getLoyaltyMemberSales,
  getLoyaltyDiscountOrders,
  getLoyaltyMemberBase,
} from "@/lib/vm-analytics/queries";
import { n, gbp, int, pct, signedPct, weekRange } from "@/lib/vm-analytics/format";
import {
  LOYALTY_ALL_STORES,
  LOYALTY_LAUNCH_WEEK,
  resolveStore,
  shortStore,
} from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section, ChartCard } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { TierBarChartCard } from "@/components/vm-analytics/charts/LazyCharts";
import { EmptyWeek, ErrorState, PageTitle } from "@/components/vm-analytics/PageState";
import type {
  LoyaltyDiscountOrderRow,
  LoyaltyMemberBaseRow,
  LoyaltyMemberSalesRow,
  LoyaltyPointsChannelRow,
  LoyaltyPointsRow,
  LoyaltyRewardRow,
  LoyaltyRewardType,
  LoyaltySignupRow,
} from "@/lib/vm-analytics/types";

export const dynamic = "force-dynamic";

const TIERS: { type: LoyaltyRewardType; label: string }[] = [
  { type: "gamma", label: "Gamma" },
  { type: "beta", label: "Beta" },
  { type: "alpha", label: "Alpha" },
];

const REWARD_TAG: Record<LoyaltyRewardType, string> = {
  gamma: "Gamma",
  beta: "Beta",
  alpha: "Alpha",
  signup: "Sign-up",
  birthday: "Birthday",
};

const TIER_CHART_WEEKS = 4;

// Heads redeemed only ever move in 10s: a completed card becomes an Alpha meal.
const HEADS_PER_CARD = 10;

function shortWeek(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function wow(cur: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-secondary">
      {children}
    </div>
  );
}

function Caveat({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs text-tertiary">{children}</p>;
}

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  const activeStore = resolveStore(searchParams.store);
  const storeKey = activeStore ?? LOYALTY_ALL_STORES;
  const scopeLabel = activeStore ? shortStore(activeStore) : "both stores";

  let week: string;
  let weekEnd = "";
  let signups: LoyaltySignupRow[];
  let points: LoyaltyPointsRow[];
  let channels: LoyaltyPointsChannelRow[];
  let rewards: LoyaltyRewardRow[];
  let memberSales: LoyaltyMemberSalesRow[];
  let discounts: LoyaltyDiscountOrderRow[];
  let memberBase: LoyaltyMemberBaseRow[];
  try {
    const weeks = await getWeeks();
    const weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;
    week = weekIso;
    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    [signups, points, channels, rewards, memberSales, discounts, memberBase] = await Promise.all([
      getLoyaltySignups(),
      getLoyaltyPoints(storeKey),
      getLoyaltyPointsChannel(storeKey, weekIso),
      getLoyaltyRewards(storeKey),
      getLoyaltyMemberSales(storeKey),
      getLoyaltyDiscountOrders(storeKey, weekIso),
      getLoyaltyMemberBase(storeKey),
    ]);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  const title = <PageTitle title="Loyalty Customers" subtitle={`${weekRange(week, weekEnd)} · ${scopeLabel}`} />;

  const pointsIdx = points.findIndex((r) => r.week_start_iso === week);
  if (pointsIdx === -1) {
    return (
      <>
        {title}
        <EmptyWeek message="The loyalty views have no row for this week yet — the loyalty sync may not have run for it." />
      </>
    );
  }

  const preLaunch = week < LOYALTY_LAUNCH_WEEK;
  // Weekly views are dense and sorted by week, so the previous row is last week.
  const pointsRow = points[pointsIdx];
  const prevPoints = points[pointsIdx - 1];

  const storeSignups = signups.filter((r) => r.store === storeKey);
  const signupRow = storeSignups.find((r) => r.week_start_iso === week);

  const cards = n(pointsRow.points_redeemed) / HEADS_PER_CARD;
  const prevCards = prevPoints ? n(prevPoints.points_redeemed) / HEADS_PER_CARD : null;

  // Rewards and member sales come from materialized views that only move when
  // vm_refresh_loyalty_snapshots() runs; the points view is live. Both are dense
  // over the same week series, so a snapshot ending earlier was never refreshed.
  const lastWeekOf = (rows: { week_start_iso: string }[]) =>
    rows.reduce((max, r) => (r.week_start_iso > max ? r.week_start_iso : max), "");
  const liveLastWeek = lastWeekOf(points);
  const snapshotLastWeek = [lastWeekOf(rewards), lastWeekOf(memberSales)].sort()[0];
  const snapshotBehind = snapshotLastWeek < liveLastWeek;
  const rewardsMissing = !rewards.some((r) => r.week_start_iso === week);

  const rewardsThisWeek = rewards.filter((r) => r.week_start_iso === week);
  const reward = (t: LoyaltyRewardType) => rewardsThisWeek.find((r) => r.reward_type === t);
  const tierRows = TIERS.map((t) => reward(t.type));
  const tierRedeemed = tierRows.reduce((s, r) => s + n(r?.redemptions), 0);
  const prevTierRedeemed = tierRows.reduce((s, r) => s + n(r?.prev_redemptions), 0);
  const loyaltyCost = rewardsThisWeek.reduce((s, r) => s + n(r.reward_cost), 0);
  const prevLoyaltyCost = rewardsThisWeek.reduce((s, r) => s + n(r.prev_reward_cost), 0);

  // Cumulative, not weekly: an Alpha meal is often claimed in a later week
  // than the card completed, so a single week's ratio can exceed 100%.
  const alphaToDate = rewards
    .filter((r) => r.reward_type === "alpha" && r.week_start_iso <= week)
    .reduce((s, r) => s + n(r.redemptions), 0);
  const cardsToDate =
    points.filter((r) => r.week_start_iso <= week).reduce((s, r) => s + n(r.points_redeemed), 0) /
    HEADS_PER_CARD;
  const rewardUseRate = cardsToDate > 0 ? (100 * alphaToDate) / cardsToDate : null;

  const msIdx = memberSales.findIndex((r) => r.week_start_iso === week);
  const ms = memberSales[msIdx];
  const prevMs = memberSales[msIdx - 1];
  const memberSalesMissing = msIdx === -1;
  const hasOrders = !!ms && n(ms.total_orders) > 0;
  const memberShare = hasOrders && !preLaunch ? 100 * n(ms.member_order_share) : null;
  const prevMemberShare =
    prevMs && n(prevMs.total_orders) > 0 && prevMs.member_order_share !== null
      ? 100 * n(prevMs.member_order_share)
      : null;

  // ── Chart series (launch → selected week) ──────────────────────────────────
  const rewardsByWeek = (iso: string, t: LoyaltyRewardType) =>
    rewards.find((r) => r.week_start_iso === iso && r.reward_type === t);

  const tierChart = points
    .filter(
      (r) => r.week_start_iso >= LOYALTY_LAUNCH_WEEK && r.week_start_iso <= week && r.week_start_iso <= snapshotLastWeek,
    )
    .slice(-TIER_CHART_WEEKS)
    .map((r) => ({
      week: shortWeek(r.week_start_iso),
      Gamma: n(rewardsByWeek(r.week_start_iso, "gamma")?.redemptions),
      Beta: n(rewardsByWeek(r.week_start_iso, "beta")?.redemptions),
      Alpha: n(rewardsByWeek(r.week_start_iso, "alpha")?.redemptions),
    }));

  // ── Member base snapshot (feeds the Loyalty customers card) ─────────────────────────────────────────────────────────────────
  // Snapshots can't be backfilled: use the selected week's if one exists,
  // otherwise the closest one, and say which.
  const snapshot =
    memberBase.find((r) => r.week_start_iso === week) ??
    [...memberBase].reverse().find((r) => r.week_start_iso <= week) ??
    memberBase[0] ??
    null;
  const snapshotIsExact = snapshot?.week_start_iso === week;
  const prevSnapshot = snapshot ? memberBase[memberBase.indexOf(snapshot) - 1] : undefined;
  const holdingMissing = snapshot?.holding_members === undefined;
  const holding = n(snapshot?.holding_members);
  const prevHolding = prevSnapshot?.holding_members == null ? null : n(prevSnapshot.holding_members);

  // ── Channel mix (selected week) ────────────────────────────────────────────
  const channelColumns: Column<LoyaltyPointsChannelRow>[] = [
    { key: "channel", header: "Channel", render: (r) => <span className="font-medium">{r.channel}</span> },
    { key: "earned", header: "Heads earned", align: "right", render: (r) => int(r.points_earnt) },
    {
      key: "earnShare",
      header: "Share",
      align: "right",
      render: (r) => (r.earnt_share === null ? "—" : pct(100 * n(r.earnt_share), 1)),
    },
  ];

  // ── Reward tiers table (selected week) ─────────────────────────────────────
  interface TierLine {
    label: string;
    row: LoyaltyRewardRow | undefined;
  }
  const tierLines: TierLine[] = [
    { label: "Gamma — free side", row: reward("gamma") },
    { label: "Beta — free main", row: reward("beta") },
    { label: "Alpha — free meal", row: reward("alpha") },
    { label: "Birthday churros", row: reward("birthday") },
  ];
  const tierColumns: Column<TierLine>[] = [
    { key: "tier", header: "Reward", render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "count", header: "Redeemed", align: "right", render: (r) => int(r.row?.redemptions) },
    { key: "wow", header: "WoW", align: "right", render: (r) => signedPct(r.row?.redemptions_wow_pct ?? null) },
    { key: "cost", header: "Cost", align: "right", render: (r) => gbp(r.row?.reward_cost) },
    {
      key: "avg",
      header: "Cost each",
      align: "right",
      render: (r) => (n(r.row?.redemptions) > 0 ? gbp(n(r.row?.reward_cost) / n(r.row?.redemptions)) : "—"),
    },
  ];
  const alphaSkuOnly = n(reward("alpha")?.sku_only_redemptions);

  // ── Members vs non-members (selected week) ─────────────────────────────────
  interface MemberLine {
    metric: string;
    member: string;
    nonMember: string;
  }
  const memberLines: MemberLine[] = ms
    ? [
        { metric: "Orders", member: int(ms.member_orders), nonMember: int(ms.non_member_orders) },
        { metric: "Net sales", member: gbp(ms.member_net_sales), nonMember: gbp(ms.non_member_net_sales) },
        {
          metric: "AOV",
          member: ms.member_aov === null ? "—" : gbp(ms.member_aov),
          nonMember: ms.non_member_aov === null ? "—" : gbp(ms.non_member_aov),
        },
        {
          metric: "Share of orders",
          member: pct(100 * n(ms.member_order_share), 1),
          nonMember: pct(100 - 100 * n(ms.member_order_share), 1),
        },
      ]
    : [];
  const memberColumns: Column<MemberLine>[] = [
    { key: "metric", header: "Metric", render: (r) => <span className="font-medium">{r.metric}</span> },
    { key: "member", header: "Members", align: "right", render: (r) => r.member },
    { key: "nonMember", header: "Non-members", align: "right", render: (r) => r.nonMember },
  ];

  // ── Discounts & promotions (selected week) ─────────────────────────────────
  const discountRows = [...discounts].sort((a, b) => n(b.discount_cost) - n(a.discount_cost));
  const discountColumns: Column<LoyaltyDiscountOrderRow>[] = [
    {
      key: "name",
      header: "Discount",
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{r.discount_name}</span>
          {r.reward_type && (
            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-secondary">
              {REWARD_TAG[r.reward_type]}
            </span>
          )}
        </span>
      ),
    },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "cost", header: "Discount cost", align: "right", render: (r) => gbp(r.discount_cost) },
    { key: "net", header: "Net sales", align: "right", render: (r) => gbp(r.net_sales) },
    // From the raw costs: the view's discount_cost_wow_pct is already rounded to 1dp.
    {
      key: "costWow",
      header: "Cost WoW",
      align: "right",
      render: (r) => signedPct(wow(n(r.discount_cost), n(r.prev_discount_cost))),
    },
  ];
  const discountedOrders = discountRows.reduce((s, r) => s + n(r.orders), 0);
  const discountCost = discountRows.reduce((s, r) => s + n(r.discount_cost), 0);
  const penetration = hasOrders ? 100 * n(ms.discount_penetration) : null;
  const prevPenetration = prevMs && n(prevMs.total_orders) > 0 ? 100 * n(prevMs.discount_penetration) : null;

  const refreshSql = <code className="font-mono text-xs">select vm_refresh_loyalty_snapshots();</code>;
  const noOrderData = memberSalesMissing ? (
    <Note>
      The member-sales snapshot hasn&apos;t been refreshed since this week synced. Run {refreshSql} in Supabase.
    </Note>
  ) : (
    <Note>
      Order-line data (<code className="font-mono text-xs">vm_detailed_sales_info</code>) isn&apos;t loaded for this
      week, so orders can&apos;t be split by member. Re-sync the week in vm-extractor.
    </Note>
  );

  return (
    <>
      {title}

      {preLaunch && (
        <div className="mb-6">
          <Note>
            Peckers Inner Circle launched on 14 Apr 2026. This week is before launch, so there are no members, Chicken
            Heads or rewards yet; sign-ups below are app accounts created before the scheme existed.
          </Note>
        </div>
      )}

      {snapshotBehind && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-secondary">
          <span className="font-semibold text-primary">Reward and member figures are out of date.</span> Their
          snapshot ends w/c {shortWeek(snapshotLastWeek)}, but loyalty data is synced to w/c {shortWeek(liveLastWeek)}
          . Rewards redeemed, loyalty discount cost and member share read &ldquo;—&rdquo; for the missing weeks until{" "}
          {refreshSql} is run in Supabase — vm-extractor should call it after every loyalty sync.
        </div>
      )}

      <div className="flex flex-col gap-8">
        <Section title="This week" description={`Loyalty KPIs for ${scopeLabel}, week-on-week.`}>
          <KpiGrid>
            <KpiCard
              label="Loyalty customers"
              value={holdingMissing ? "—" : int(holding)}
              delta={holdingMissing ? null : wow(holding, prevHolding)}
              hint={
                !snapshot
                  ? "no snapshot yet"
                  : holdingMissing
                    ? "re-run vm_loyalty_views.sql"
                    : snapshotIsExact
                      ? undefined
                      : `snapshot w/c ${shortWeek(snapshot.week_start_iso)}`
              }
            />
            <KpiCard
              label="New members"
              value={int(signupRow?.signups)}
              delta={signupRow?.signups_wow_pct ?? null}
            />
            <KpiCard
              label="Active earners"
              value={int(pointsRow.active_earners)}
              delta={pointsRow.active_earners_wow_pct}
              hint="earned a head"
            />
            <KpiCard
              label="Chicken Heads earned"
              value={int(pointsRow.points_earnt)}
              delta={pointsRow.points_earnt_wow_pct}
            />
            <KpiCard
              label="Alpha meals unlocked"
              value={int(cards)}
              delta={wow(cards, prevCards)}
              hint="10 heads = 1 free meal"
            />
            <KpiCard
              label="Reward use rate"
              value={rewardUseRate === null || rewardsMissing ? "—" : pct(rewardUseRate, 1)}
              hint={rewardsMissing ? "snapshot not refreshed" : "Alpha meals claimed ÷ unlocked, to date"}
            />
            <KpiCard
              label="Rewards redeemed"
              value={rewardsMissing ? "—" : int(tierRedeemed)}
              delta={rewardsMissing ? null : wow(tierRedeemed, prevTierRedeemed)}
              hint={
                rewardsMissing
                  ? "snapshot not refreshed"
                  : TIERS.map((t, i) => `${t.label[0]} ${int(tierRows[i]?.redemptions)}`).join(" · ")
              }
            />
            <KpiCard
              label="Loyalty discount cost"
              value={rewardsMissing ? "—" : gbp(loyaltyCost)}
              delta={rewardsMissing ? null : wow(loyaltyCost, prevLoyaltyCost)}
              hint={rewardsMissing ? "snapshot not refreshed" : "incl. sign-up & birthday"}
            />
            <KpiCard
              label="Member share of orders"
              value={memberShare === null ? "—" : pct(memberShare, 1)}
              delta={memberShare === null ? null : wow(memberShare, prevMemberShare)}
              hint={
                preLaunch
                  ? "pre-launch"
                  : memberSalesMissing
                    ? "snapshot not refreshed"
                    : !hasOrders
                      ? "no order data"
                      : undefined
              }
            />
          </KpiGrid>
        </Section>

        <Section
          title="Chicken Heads"
          description="One head per day a member spends £12+. Heads are only deducted when a card reaches 10 and becomes an Alpha meal — Gamma and Beta don't use them up."
        >
          <DataTable
            caption={`Channel mix — w/c ${shortWeek(week)}`}
            columns={channelColumns}
            rows={preLaunch ? [] : channels}
            emptyMessage="No loyalty activity before launch."
          />
        </Section>

        <Section
          title="Rewards redeemed"
          description="From the Loyalty Gamma / Beta / Alpha discounts. Alpha also counts orders rung through an “Alpha …” meal SKU, once per order."
        >
          {tierChart.length === 0 ? (
            <Note>No rewards before launch.</Note>
          ) : (
            <ChartCard title={`Redemptions by tier — last ${tierChart.length} weeks`}>
              <TierBarChartCard
                data={tierChart}
                xKey="week"
                bars={[
                  { key: "Gamma", name: "Gamma — free side", opacity: 0.35 },
                  { key: "Beta", name: "Beta — free main", opacity: 0.65 },
                  { key: "Alpha", name: "Alpha — free meal", opacity: 1 },
                ]}
              />
            </ChartCard>
          )}
          <DataTable
            caption={`Rewards — w/c ${shortWeek(week)}`}
            columns={tierColumns}
            rows={preLaunch || rewardsMissing ? [] : tierLines}
            emptyMessage={rewardsMissing ? "Rewards snapshot not refreshed for this week." : "No rewards before launch."}
          />
          {!preLaunch && !rewardsMissing && tierRedeemed === 0 && <Caveat>No tier rewards were redeemed this week.</Caveat>}
          {alphaSkuOnly > 0 && (
            <Caveat>
              {int(alphaSkuOnly)} Alpha {alphaSkuOnly === 1 ? "meal was" : "meals were"} rung through an Alpha SKU
              without the discount; the SKU price already makes it free, so no cost is recorded for{" "}
              {alphaSkuOnly === 1 ? "it" : "them"}.
            </Caveat>
          )}
        </Section>

        <Section
          title="Members vs non-members"
          description="Orders placed by loyalty members (after they registered) against everyone else."
        >
          {preLaunch ? (
            <Note>Nobody was a member before launch (w/c 13 Apr 2026), so every order this week is a non-member order.</Note>
          ) : !hasOrders ? (
            noOrderData
          ) : (
            <DataTable caption={`w/c ${shortWeek(week)}`} columns={memberColumns} rows={memberLines} />
          )}
        </Section>

        <Section
          title="Discounts & promotions"
          description="Every discounted order this week, by discount. Loyalty rewards are tagged."
        >
          <KpiGrid>
            <KpiCard label="Discounted orders" value={int(discountedOrders)} />
            <KpiCard label="Discount cost" value={gbp(discountCost)} />
            <KpiCard
              label="Discount penetration"
              value={penetration === null ? "—" : pct(penetration, 1)}
              delta={penetration === null ? null : wow(penetration, prevPenetration)}
              hint={hasOrders ? "discounted ÷ all orders" : "no order data"}
            />
          </KpiGrid>
          <DataTable
            columns={discountColumns}
            rows={discountRows}
            emptyMessage="No discounted orders this week."
          />
        </Section>
      </div>
    </>
  );
}
