import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Skeleton className="h-44 mb-5 rounded-2xl" />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Skeleton className="h-10 sm:w-32" />
          <Skeleton className="h-10 sm:w-32" />
        </div>
        <Skeleton className="h-64 lg:h-44 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl order-3 lg:order-2" />
          <Skeleton className="h-56 rounded-2xl order-2 lg:order-3" />
        </div>
      </div>
    </>
  );
}
