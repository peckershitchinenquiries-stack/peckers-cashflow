import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="flex gap-3 mb-5">
        <Skeleton className="h-10 w-full max-w-xs rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <TableSkeleton rows={10} />
    </>
  );
}
