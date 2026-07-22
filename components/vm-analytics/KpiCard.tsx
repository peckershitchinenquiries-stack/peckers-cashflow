import { signedPct, n } from "@/lib/vm-analytics/format";

// One side of the two-column comparison block used by the 4/12-week Executive
// views: the comparison period's own absolute figure plus its signed delta.
export type KpiComparison = {
  label: string;
  value: string;
  pct: number | null;
  title?: string;
};

function ComparisonCell({ label, value, pct, title }: KpiComparison) {
  const known = pct !== null && pct !== undefined;
  const up = known && pct >= 0;
  return (
    <div className="min-w-0 text-center" title={title}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-tertiary">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-secondary">{value}</div>
      <div
        className={[
          "mt-0.5 text-xs font-semibold",
          !known ? "text-tertiary" : up ? "text-success" : "text-danger",
        ].join(" ")}
      >
        {known ? `${up ? "▲" : "▼"} ${signedPct(pct)}` : "—"}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel = "WoW",
  deltaTitle = "Week-on-Week vs previous week",
  yoy,
  comparisons,
  hint,
  tone,
}: {
  label: string;
  value: string;
  delta?: number | string | null;
  // Badge suffix and tooltip for `delta`. Default to week-on-week; the
  // Executive dashboard's 4/12-week modes override them with the
  // prior-period wording ("vs prev 4w").
  deltaLabel?: string;
  deltaTitle?: string;
  yoy?: number | null;
  // When supplied, the two-column comparison block replaces the pill badges.
  comparisons?: readonly [KpiComparison, KpiComparison];
  hint?: string;
  // Semantic colour for the value: "good" (green — in-store / own delivery,
  // margin-friendly) or "bad" (red — aggregator commission). Omit for neutral.
  tone?: "good" | "bad";
}) {
  const showDelta = delta !== undefined;
  const valueClass =
    tone === "good"
      ? "text-success"
      : tone === "bad"
      ? "text-danger"
      : "text-text-primary";

  if (comparisons) {
    return (
      <div className="vm-card p-4">
        <div className="text-center text-xs font-medium uppercase tracking-wide text-secondary">
          {label}
        </div>
        <div className={`mt-2 text-center text-2xl font-bold break-words sm:text-3xl ${valueClass}`}>
          {value}
        </div>
        {hint && <div className="mt-1 text-center text-xs text-tertiary">{hint}</div>}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <ComparisonCell {...comparisons[0]} />
          <ComparisonCell {...comparisons[1]} />
        </div>
      </div>
    );
  }

  return (
    <div className="vm-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-secondary">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold break-words sm:text-3xl ${valueClass}`}>{value}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {showDelta && (
          <span
            className={[
              "font-medium px-1.5 py-0.5 rounded",
              delta === null || delta === undefined || delta === ""
                ? "bg-surface-hover text-tertiary"
                : n(delta) >= 0
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            ].join(" ")}
            title={deltaTitle}
          >
            {signedPct(delta)} {deltaLabel}
          </span>
        )}
        {typeof yoy === "number" && (
          <span
            className={[
              "font-medium px-1.5 py-0.5 rounded",
              yoy >= 0
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            ].join(" ")}
            title="Year-on-Year vs same week last year"
          >
            {signedPct(yoy)} YoY
          </span>
        )}
        {hint && <span className="text-tertiary">{hint}</span>}
      </div>
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}
