import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface relative overflow-hidden",
        className,
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite_linear]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, rgb(var(--color-surface-hover) / 0.9) 50%, transparent 100%)",
        }}
      />
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }`}</style>
    </div>
  );
}
