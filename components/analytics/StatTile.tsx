import { Card } from "@/components/ui/Card";
import { cn, formatINR } from "@/lib/utils";

export function StatTile({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "danger" | "gold";
  hint?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "gold"
          ? "text-gold"
          : "text-text-primary";
  return (
    <Card className="max-sm:p-3.5">
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.18em] text-text-muted font-medium leading-snug">
        {label}
      </p>
      <p className={cn("text-xl sm:text-2xl font-semibold mt-1.5 sm:mt-2 tabular-nums break-words", toneClass)}>
        {formatINR(value)}
      </p>
      {hint && <div className="mt-2">{hint}</div>}
    </Card>
  );
}
