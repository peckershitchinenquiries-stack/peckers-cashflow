import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

/**
 * Composable skeleton building blocks used by every route's `loading.tsx`.
 * These mirror the real page layouts (header + cards + table/chart) so the
 * swap to live content is visually stable — no layout shift, no flash.
 */

export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-64 sm:w-96" />
      </div>
      {withAction && <Skeleton className="h-10 w-32 rounded-xl" />}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-surface border border-border p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3 w-full">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      </div>
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-surface border border-border p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16 hidden sm:block" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

export function FormCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
      <Skeleton className="h-5 w-36" />
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function GridCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface border border-border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
