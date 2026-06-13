import { signedPct, deltaClass } from "@/lib/vm-analytics/format";

export function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | string | null;
  hint?: string;
}) {
  const showDelta = delta !== undefined;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {showDelta && (
          <span className={`font-medium ${deltaClass(delta)}`}>
            {signedPct(delta)} WoW
          </span>
        )}
        {hint && <span className="text-ink-faint">{hint}</span>}
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
