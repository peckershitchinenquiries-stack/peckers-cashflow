import { getLoyaltyActivity, getLoyaltyMemberBase } from "@/lib/vm-analytics/queries";
import { int, n, pct } from "@/lib/vm-analytics/format";
import { STORES, shortStore } from "@/lib/vm-analytics/constants";
import { KpiCard, KpiGrid } from "@/components/vm-analytics/KpiCard";
import { Section } from "@/components/vm-analytics/Section";
import { DataTable, type Column } from "@/components/vm-analytics/DataTable";
import type { LoyaltyActivityRow, LoyaltyMemberBaseRow } from "@/lib/vm-analytics/types";
import { Caveat, InsightsMissing, Note, ShareBar, pickSnapshot, share, shortWeek } from "./shared";

interface FunnelLine {
  step: string;
  members: number;
  ofFirst: number | null;
  ofPrevious: number | null;
}

interface SegmentLine {
  segment: string;
  who: string;
  members: number;
  share: number | null;
}

interface StoreLine {
  store: string;
  row: LoyaltyMemberBaseRow | null;
}

function funnelLines(a: LoyaltyActivityRow): FunnelLine[] {
  const steps: Array<[string, number]> = [
    ["Earned a head from an order (1+ visit)", n(a.visited_1)],
    ["Came back (2+ visits)", n(a.visited_2)],
    ["3+ visits", n(a.visited_3)],
    ["6+ visits", n(a.visited_6)],
    ["9+ visits (a full card, with the starting head)", n(a.visited_9)],
    ["Unlocked a free meal", n(a.unlocked_meal)],
  ];
  return steps.map(([step, members], i) => ({
    step,
    members,
    ofFirst: share(members, steps[0][1]),
    ofPrevious: i === 0 ? null : share(members, steps[i - 1][1]),
  }));
}

function segmentLines(a: LoyaltyActivityRow): SegmentLine[] {
  const lines: Array<[string, string, number]> = [
    ["Champions", "Visited in 4+ of the last 8 weeks", n(a.seg_champion)],
    ["Regulars", "Visited in 2–3 of the last 8 weeks", n(a.seg_regular)],
    ["Occasional", "One visit in the last 8 weeks, within the last 4", n(a.seg_occasional)],
    // Not "New" or "Lapsed": the Overview's New sign-ups and the member base's
    // Lapsed card count different people.
    ["First-timers", "First visit in the last 4 weeks", n(a.seg_new)],
    ["At risk", "Last visit 5–8 weeks ago", n(a.seg_at_risk)],
    ["Inactive", "No visit for 8+ weeks", n(a.seg_lapsed)],
  ];
  const total = lines.reduce((s, l) => s + l[2], 0);
  return lines.map(([segment, who, members]) => ({ segment, who, members, share: share(members, total) }));
}

export async function MembersTab({
  storeKey,
  scopeLabel,
  week,
  memberBase,
  showStoreSplit,
}: {
  storeKey: string;
  scopeLabel: string;
  week: string;
  memberBase: LoyaltyMemberBaseRow[];
  showStoreSplit: boolean;
}) {
  const [activity, storeBases] = await Promise.all([
    getLoyaltyActivity(storeKey),
    showStoreSplit ? Promise.all(STORES.map((s) => getLoyaltyMemberBase(s))) : Promise.resolve(null),
  ]);

  const snapshot = pickSnapshot(memberBase, week);
  const firstSnapshot = memberBase[0] ?? null;
  const snapshotNote =
    snapshot && snapshot.week_start_iso !== week ? `snapshot w/c ${shortWeek(snapshot.week_start_iso)}` : undefined;
  const reactivated =
    snapshot && firstSnapshot && snapshot !== firstSnapshot
      ? Math.max(0, n(firstSnapshot.imported_members) - n(snapshot.imported_members))
      : null;

  const act = activity.rows.find((r) => r.week_start_iso === week);

  const funnelColumns: Column<FunnelLine>[] = [
    { key: "step", header: "Step", render: (r) => <span className="font-medium">{r.step}</span> },
    { key: "members", header: "Members", align: "right", render: (r) => int(r.members) },
    {
      key: "ofFirst",
      header: "Of first step",
      align: "right",
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <ShareBar value={r.ofFirst} />
          {r.ofFirst === null ? "—" : pct(r.ofFirst, 1)}
        </span>
      ),
    },
    {
      key: "ofPrevious",
      header: "Kept from step before",
      align: "right",
      render: (r) => (r.ofPrevious === null ? "—" : pct(r.ofPrevious, 1)),
    },
  ];

  const segmentColumns: Column<SegmentLine>[] = [
    { key: "segment", header: "Segment", render: (r) => <span className="font-medium">{r.segment}</span> },
    { key: "who", header: "Who", render: (r) => <span className="text-secondary">{r.who}</span> },
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

  const storeLines: StoreLine[] = storeBases
    ? STORES.map((s, i) => ({ store: shortStore(s), row: pickSnapshot(storeBases[i], week) }))
    : [];
  const storeColumns: Column<StoreLine>[] = [
    { key: "store", header: "Store", render: (r) => <span className="font-medium">{r.store}</span> },
    { key: "engaged", header: "Joined or used", align: "right", render: (r) => int(r.row?.active_members) },
    { key: "active", header: "Active 30 days", align: "right", render: (r) => int(r.row?.active_30d_members) },
    {
      key: "activeShare",
      header: "% of joined active",
      align: "right",
      render: (r) => {
        const s = share(r.row?.active_30d_members, r.row?.active_members);
        return s === null ? "—" : pct(s, 1);
      },
    },
    { key: "lapsed", header: "Lapsed", align: "right", render: (r) => int(r.row?.lapsed_members) },
    { key: "imports", header: "Dormant imports", align: "right", render: (r) => int(r.row?.imported_members) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Member base"
        description={`Everyone on the loyalty list for ${scopeLabel}, split by whether they have actually used the scheme.`}
      >
        {!snapshot ? (
          <Note>No member snapshot has been synced yet.</Note>
        ) : (
          <KpiGrid>
            <KpiCard label="Joined or used the scheme" value={int(snapshot.active_members)} hint={snapshotNote ?? "not the launch import"} />
            <KpiCard
              label="Active in the last 30 days"
              value={int(snapshot.active_30d_members)}
              hint={`${pct(share(snapshot.active_30d_members, snapshot.active_members) ?? 0, 1)} of those who joined`}
            />
            <KpiCard label="Lapsed (30+ days quiet)" value={int(snapshot.lapsed_members)} hint="joined, gone quiet" />
            <KpiCard label="Dormant imports" value={int(snapshot.imported_members)} hint="copied over at launch, never used it" />
            <KpiCard
              label="Imports won back"
              value={reactivated === null ? "—" : int(reactivated)}
              hint={firstSnapshot ? `since w/c ${shortWeek(firstSnapshot.week_start_iso)}` : undefined}
            />
          </KpiGrid>
        )}
      </Section>

      <Section
        title="How far members have got"
        description="Lifetime progress to the selected week. A visit is a day the member spent £12+ (one Chicken Head each)."
      >
        {activity.missing ? (
          <InsightsMissing />
        ) : !act ? (
          <Note>No visits before launch.</Note>
        ) : (
          <>
            <DataTable caption={`To w/c ${shortWeek(week)}`} columns={funnelColumns} rows={funnelLines(act)} />
            <Caveat>
              Every member also starts with 1 free head that no order earned; it isn&apos;t counted as a visit, which is why 9
              visits fill a 10-head card. &ldquo;Unlocked a free meal&rdquo; means a full card turned into an Alpha meal,
              whether or not it has been claimed.
            </Caveat>
          </>
        )}
      </Section>

      <Section
        title="Segments"
        description="Members who have visited at least once, grouped by how recently and how often they come in."
      >
        {activity.missing ? (
          <InsightsMissing />
        ) : !act ? (
          <Note>No visits before launch.</Note>
        ) : (
          <DataTable caption={`As at w/c ${shortWeek(week)}`} columns={segmentColumns} rows={segmentLines(act)} />
        )}
        {showStoreSplit ? null : (
          <Caveat>Store view: only visits made at {scopeLabel} count.</Caveat>
        )}
      </Section>

      {showStoreSplit && (
        <Section title="By store" description="The member base for each store, from the same snapshot.">
          <DataTable columns={storeColumns} rows={storeLines} />
          <Caveat>
            VM credited Hitchin with 588–815 sign-ups a week from 13 Apr to 17 May 2026, against 29–75 at Stevenage, while
            Stevenage had far more member orders. Until VM explains how a home store is chosen, Hitchin&apos;s member
            counts here are probably too high and Stevenage&apos;s too low. Visit-based figures are recorded where the order
            happened, so they are unaffected.
          </Caveat>
        </Section>
      )}
    </div>
  );
}
