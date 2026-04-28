import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-8 w-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center">
        <span className="text-gold font-bold tracking-tight text-sm">W</span>
      </div>
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span className="text-text-primary font-semibold tracking-wide text-sm">
            Peckers
          </span>
          <span className="text-text-muted text-[10px] uppercase tracking-[0.18em]">
            by WEBCROS
          </span>
        </div>
      )}
    </div>
  );
}
