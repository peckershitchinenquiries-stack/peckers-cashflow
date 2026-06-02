import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="mt-6">
        <TableSkeleton rows={6} />
      </div>
    </>
  );
}
