import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  GridCardsSkeleton,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <div className="mt-6">
        <GridCardsSkeleton count={6} />
      </div>
    </>
  );
}
