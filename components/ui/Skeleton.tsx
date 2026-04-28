import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r from-surface via-[#222] to-surface bg-[length:200%_100%] animate-[shimmer_1.4s_infinite_linear]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, #1a1a1a 0%, #232323 50%, #1a1a1a 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite linear",
      }}
    >
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}
