import { Skeleton } from "@/components/ui/Skeleton";
import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  ChartSkeleton,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Skeleton className="h-12 w-48 rounded-xl mb-6" />
      <div className="flex flex-col gap-5">
        <Skeleton className="h-[88px] w-full" />
        <StatCardsSkeleton />
        <ChartSkeleton height={280} />
        <ChartSkeleton height={120} />
      </div>
    </>
  );
}
