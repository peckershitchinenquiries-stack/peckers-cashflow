import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="max-w-md mx-auto space-y-5">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </>
  );
}
