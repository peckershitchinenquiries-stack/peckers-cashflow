import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span className="text-text-primary font-semibold tracking-wide text-sm">
            Peckers
          </span>
          <span className="text-text-muted text-[10px] uppercase tracking-[0.18em]">
            Cash flow
          </span>
        </div>
      )}
    </div>
  );
}
