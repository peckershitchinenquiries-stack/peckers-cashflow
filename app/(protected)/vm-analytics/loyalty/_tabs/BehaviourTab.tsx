import { getLoyaltyOrderProfile } from "@/lib/vm-analytics/queries";
import { gbp, int, n, pct, truncTo } from "@/lib/vm-analytics/format";
import { ChartCard, Section } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import { BarChartCard } from "@/components/vm-analytics/charts/LazyCharts";
import type { LoyaltyOrderProfileRow } from "@/lib/vm-analytics/types";
import { Caveat, InsightsMissing, Note, ShareBar, addDaysIso, chartPct, share, shortWeek, splitByBucket } from "./shared";

const TOP_ITEMS = 10;
const TOP_PICKS = 6;
const IN_STORE = new Set(["Kiosk", "Till"]);
// Reward SKUs and the delivery fee are lines, not choices a customer makes.
const NOT_AN_ITEM = /^(alpha|beta|gamma)\b|delivery fee/i;

interface ChannelLine {
  channel: string;
  orders: number;
  memberOrders: number;
  memberNet: number;
  total?: boolean;
}

interface ItemLine {
  item: string;
  member: number;
  memberShare: number | null;
  nonMemberShare: number | null;
}

interface PickLine {
  item: string;
  times: number;
  share: number | null;
}

function channelLines(rows: LoyaltyOrderProfileRow[]): ChannelLine[] {
  const byChannel = new Map<string, ChannelLine & { rank: number }>();
  for (const r of rows) {
    const line = byChannel.get(r.bucket) ?? {
      channel: r.bucket,
      rank: n(r.bucket_rank),
      orders: 0,
      memberOrders: 0,
      memberNet: 0,
    };
    line.orders += n(r.orders);
    if (r.is_member) {
      line.memberOrders += n(r.orders);
      line.memberNet += n(r.net_sales);
    }
    byChannel.set(r.bucket, line);
  }
  const lines = [...byChannel.values()].sort((a, b) => a.rank - b.rank);
  const inStore = lines.filter((l) => IN_STORE.has(l.channel));
  if (inStore.length === 0) return lines;
  return [
    ...lines,
    {
      channel: "In store (kiosk + till)",
      rank: 99,
      orders: inStore.reduce((s, l) => s + l.orders, 0),
      memberOrders: inStore.reduce((s, l) => s + l.memberOrders, 0),
      memberNet: inStore.reduce((s, l) => s + l.memberNet, 0),
      total: true,
    },
  ];
}

function memberVsNonChart(rows: LoyaltyOrderProfileRow[], xKey: string) {
  const split = splitByBucket(rows);
  const memberTotal = split.reduce((s, b) => s + b.member, 0);
  const nonMemberTotal = split.reduce((s, b) => s + b.nonMember, 0);
  return {
    empty: memberTotal + nonMemberTotal === 0,
    data: split.map((b) => ({
      [xKey]: b.bucket,
      Members: chartPct(share(b.member, memberTotal)),
      "Non-members": chartPct(share(b.nonMember, nonMemberTotal)),
    })),
  };
}

function pickLines(rows: LoyaltyOrderProfileRow[]): PickLine[] {
  const split = splitByBucket(rows);
  const total = split.reduce((s, b) => s + b.member, 0);
  return split
    .sort((a, b) => b.member - a.member)
    .slice(0, TOP_PICKS)
    .map((b) => ({ item: b.bucket, times: b.member, share: share(b.member, total) }));
}

const BARS = [
  { key: "Members", name: "Members" },
  { key: "Non-members", name: "Non-members" },
];

export async function BehaviourTab({ storeKey, week }: { storeKey: string; week: string }) {
  const from = addDaysIso(week, -21);
  const [channel, weekday, daypart, items, gamma, beta] = await Promise.all([
    getLoyaltyOrderProfile(storeKey, "channel", from, week),
    getLoyaltyOrderProfile(storeKey, "weekday", from, week),
    getLoyaltyOrderProfile(storeKey, "daypart", from, week),
    getLoyaltyOrderProfile(storeKey, "item", from, week),
    getLoyaltyOrderProfile(storeKey, "reward_gamma", from, week),
    getLoyaltyOrderProfile(storeKey, "reward_beta", from, week),
  ]);

  if (channel.missing) {
    return <InsightsMissing />;
  }

  const thisWeek = channelLines(channel.rows.filter((r) => r.week_start_iso === week));

  const inStore4w = channel.rows.filter((r) => IN_STORE.has(r.bucket));
  const memberInStore = inStore4w.filter((r) => r.is_member).reduce((s, r) => s + n(r.orders), 0);
  const nonMemberInStore = inStore4w.filter((r) => !r.is_member).reduce((s, r) => s + n(r.orders), 0);
  const itemLines: ItemLine[] = splitByBucket(items.rows)
    .filter((b) => !NOT_AN_ITEM.test(b.bucket))
    .sort((a, b) => b.member - a.member)
    .slice(0, TOP_ITEMS)
    .map((b) => ({
      item: b.bucket,
      member: b.member,
      memberShare: share(b.member, memberInStore),
      nonMemberShare: share(b.nonMember, nonMemberInStore),
    }));

  const weekdayChart = memberVsNonChart(weekday.rows, "day");
  const daypartChart = memberVsNonChart(daypart.rows, "time");

  const channelColumns: Column<ChannelLine>[] = [
    {
      key: "channel",
      header: "Channel",
      render: (r) => <span className={r.total ? "font-semibold" : "font-medium"}>{r.channel}</span>,
    },
    { key: "orders", header: "Orders", align: "right", render: (r) => int(r.orders) },
    { key: "member", header: "Member orders", align: "right", render: (r) => int(r.memberOrders) },
    {
      key: "share",
      header: "Member share",
      align: "right",
      render: (r) => {
        const s = share(r.memberOrders, r.orders);
        return (
          <span className="inline-flex items-center justify-end gap-2">
            <ShareBar value={s} />
            {s === null ? "—" : pct(s, 1)}
          </span>
        );
      },
    },
    { key: "net", header: "Member net sales", align: "right", render: (r) => gbp(r.memberNet) },
  ];

  const itemColumns: Column<ItemLine>[] = [
    { key: "item", header: "Item", render: (r) => <span className="font-medium">{r.item}</span> },
    { key: "member", header: "Member orders", align: "right", render: (r) => int(r.member) },
    { key: "ms", header: "% of member orders", align: "right", render: (r) => (r.memberShare === null ? "—" : pct(r.memberShare, 1)) },
    {
      key: "ns",
      header: "% of non-member orders",
      align: "right",
      render: (r) => (r.nonMemberShare === null ? "—" : pct(r.nonMemberShare, 1)),
    },
    {
      key: "diff",
      header: "Difference",
      align: "right",
      render: (r) => {
        if (r.memberShare === null || r.nonMemberShare === null) return "—";
        const d = truncTo(r.memberShare - r.nonMemberShare, 1);
        return `${d > 0 ? "+" : ""}${d.toFixed(1)} pts`;
      },
    },
  ];

  const pickColumns: Column<PickLine>[] = [
    { key: "item", header: "Item chosen", render: (r) => <span className="font-medium">{r.item}</span> },
    { key: "times", header: "Times", align: "right", render: (r) => int(r.times) },
    { key: "share", header: "Share", align: "right", render: (r) => (r.share === null ? "—" : pct(r.share, 1)) },
  ];

  const window4w = `4 weeks to w/c ${shortWeek(week)}`;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Member orders by channel"
        description={`w/c ${shortWeek(week)}. Delivery-app customers can never be members and every Peckers-app order is a member order, so in store is where loyalty is the customer's choice.`}
      >
        <DataTable columns={channelColumns} rows={thisWeek} emptyMessage="No orders this week." />
      </Section>

      <Section title="When members come in" description={`In-store orders, ${window4w}: each group's orders spread across the week and the day.`}>
        {weekdayChart.empty ? (
          <Note>No in-store orders in these weeks.</Note>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="By day of week (% of each group's orders)">
              <BarChartCard data={weekdayChart.data} xKey="day" bars={BARS} />
            </ChartCard>
            <ChartCard title="By time of day (% of each group's orders)">
              <BarChartCard data={daypartChart.data} xKey="time" bars={BARS} />
            </ChartCard>
          </div>
        )}
      </Section>

      <Section title="What members buy" description={`Top items on member in-store orders, ${window4w}, against non-members.`}>
        <DataTable columns={itemColumns} rows={itemLines} emptyMessage="No in-store member orders in these weeks." />
        <Caveat>
          Share = how many of that group&apos;s in-store orders included the item. Alpha / Beta / Gamma reward SKUs and the
          delivery fee are left out; an item taken free as a Gamma or Beta reward still counts, which lifts Fries and The OG
          Burger a little for members.
        </Caveat>
      </Section>

      <Section title="Rewards members choose" description={`The free item picked on Gamma and Beta rewards, ${window4w}, all channels.`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable caption="Gamma — free side" columns={pickColumns} rows={pickLines(gamma.rows)} emptyMessage="No Gamma rewards in these weeks." />
          <DataTable caption="Beta — free main" columns={pickColumns} rows={pickLines(beta.rows)} emptyMessage="No Beta rewards in these weeks." />
        </div>
      </Section>
    </div>
  );
}
