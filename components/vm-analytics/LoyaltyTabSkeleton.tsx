import { Skeleton } from "@/components/ui/Skeleton";
import type { LoyaltyTab } from "@/lib/vm-analytics/loyalty-tabs";

type Block =
  | { kind: "kpis"; count: number }
  | { kind: "box"; height: number }
  | { kind: "pair"; height: number };

// Rough outline of each tab's sections, so the swap to real content barely shifts.
const LAYOUT: Record<LoyaltyTab, Block[][]> = {
  overview: [
    [{ kind: "kpis", count: 9 }],
    [{ kind: "box", height: 220 }],
    [{ kind: "box", height: 300 }, { kind: "box", height: 260 }],
    [{ kind: "box", height: 130 }],
  ],
  members: [
    [{ kind: "kpis", count: 5 }],
    [{ kind: "box", height: 300 }],
    [{ kind: "box", height: 300 }],
    [{ kind: "box", height: 140 }],
  ],
  retention: [
    [{ kind: "kpis", count: 5 }],
    [{ kind: "box", height: 300 }],
    [{ kind: "box", height: 220 }],
    [{ kind: "box", height: 320 }],
  ],
  value: [
    [{ kind: "kpis", count: 6 }],
    [{ kind: "box", height: 300 }],
    [{ kind: "box", height: 340 }],
  ],
  behaviour: [
    [{ kind: "box", height: 300 }],
    [{ kind: "pair", height: 300 }],
    [{ kind: "box", height: 380 }],
    [{ kind: "pair", height: 260 }],
  ],
};

function BlockSkeleton({ block }: { block: Block }) {
  if (block.kind === "kpis") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: block.count }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] border border-border" />
        ))}
      </div>
    );
  }
  if (block.kind === "pair") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="border border-border" style={{ height: block.height }} />
        <Skeleton className="border border-border" style={{ height: block.height }} />
      </div>
    );
  }
  return <Skeleton className="border border-border" style={{ height: block.height }} />;
}

export function LoyaltyTabSkeleton({ tab }: { tab: LoyaltyTab }) {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      {LAYOUT[tab].map((section, i) => (
        <div key={i} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          {section.map((block, j) => (
            <BlockSkeleton key={j} block={block} />
          ))}
        </div>
      ))}
    </div>
  );
}
