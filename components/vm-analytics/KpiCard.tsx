import { signedPct, deltaClass } from "@/lib/vm-analytics/format";

export function KpiCard({
  label,
  value,
  delta,
  hint,
  tone,
}: {
  label: string;
  value: string;
  delta?: number | string | null;
  hint?: string;
  // Semantic colour for the value: "good" (green — in-store / own delivery,
  // margin-friendly) or "bad" (red — aggregator commission). Omit for neutral.
  tone?: "good" | "bad";
}) {
  const showDelta = delta !== undefined;
  const valueClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
      ? "text-rose-600 dark:text-rose-400"
      : "text-primary";
  return (
    <div className="vm-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-secondary">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {showDelta && (
          <span className={`font-semibold ${deltaClass(delta)}`}>
            {signedPct(delta)} WoW
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
