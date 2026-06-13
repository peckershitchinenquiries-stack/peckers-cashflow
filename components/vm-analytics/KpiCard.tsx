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
    <div className="vm-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-secondary">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-primary">{value}</div>
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
