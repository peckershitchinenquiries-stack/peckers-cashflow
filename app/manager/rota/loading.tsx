import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </>
  );
}
