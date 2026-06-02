import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton, GridCardsSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <div className="flex gap-3 mb-5">
        <Skeleton className="h-10 w-full max-w-xs rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <GridCardsSkeleton count={6} />
    </>
  );
}
