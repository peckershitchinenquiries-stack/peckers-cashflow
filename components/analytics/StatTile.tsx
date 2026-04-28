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
    <Card>
      <p className="text-xs uppercase tracking-[0.18em] text-text-muted font-medium">
        {label}
      </p>
      <p className={cn("text-2xl font-semibold mt-2", toneClass)}>
        {formatINR(value)}
      </p>
      {hint && <div className="mt-2">{hint}</div>}
    </Card>
  );
}
