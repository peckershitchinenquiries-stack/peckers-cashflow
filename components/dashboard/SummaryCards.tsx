import { Card } from "@/components/ui/Card";
import { cn, formatINR } from "@/lib/utils";
import {
  ShoppingBagIcon,
  TrendDownIcon,
  TrendUpIcon,
  WalletIcon,
} from "@/components/ui/icons";

type Props = {
  todaySales: number;
  todayExp: number;
  todayNet: number;
  weekNet: number;
};

function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "gold";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "gold"
          ? "text-gold"
          : "text-text-primary";
  const iconBg =
    tone === "success"
      ? "bg-success/10 text-success border-success/20"
      : tone === "danger"
        ? "bg-danger/10 text-danger border-danger/20"
        : tone === "gold"
          ? "bg-gold/10 text-gold border-gold/30"
          : "bg-surface-hover text-text-muted border-border";

  return (
    <Card className="hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted font-medium">
            {label}
          </p>
          <p className={cn("text-2xl sm:text-3xl font-semibold mt-2 truncate", toneClass)}>
            {value}
          </p>
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0",
            iconBg,
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function SummaryCards({ todaySales, todayExp, todayNet, weekNet }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard
        label="Today's Sales"
        value={formatINR(todaySales)}
        icon={<ShoppingBagIcon size={18} />}
        tone="gold"
      />
      <StatCard
        label="Today's Expenses"
        value={formatINR(todayExp)}
        icon={<WalletIcon size={18} />}
      />
      <StatCard
        label="Today's Net"
        value={formatINR(todayNet)}
        icon={todayNet >= 0 ? <TrendUpIcon size={18} /> : <TrendDownIcon size={18} />}
        tone={todayNet >= 0 ? "success" : "danger"}
      />
      <StatCard
        label="This Week's Net"
        value={formatINR(weekNet)}
        icon={weekNet >= 0 ? <TrendUpIcon size={18} /> : <TrendDownIcon size={18} />}
        tone={weekNet >= 0 ? "success" : "danger"}
      />
    </div>
  );
}
