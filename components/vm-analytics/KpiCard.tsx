import { signedPct, deltaClass } from "@/lib/vm-analytics/format";

export function KpiCard({
  label,
  value,
  delta,
  yoy,
  hint,
  tone,
}: {
  label: string;
  value: string;
  delta?: number | string | null;
  yoy?: number | null;
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
  return (
    <div className="vm-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-secondary">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold break-words sm:text-3xl ${valueClass}`}>{value}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {showDelta && (
          <span className={`font-semibold ${deltaClass(delta)}`}>
            {signedPct(delta)} WoW
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
