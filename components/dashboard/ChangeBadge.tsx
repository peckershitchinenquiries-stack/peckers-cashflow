import { signedPct } from "@/lib/vm-analytics/format";
import { cn } from "@/lib/utils";

/** ▲/▼ badge for a whole-percentage change; renders nothing when unknown. */
export function ChangeBadge({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-medium tabular-nums",
          up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
        )}
      >
        {up ? "▲" : "▼"} {signedPct(Math.abs(pct)).replace("+", "")}
      </span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}
