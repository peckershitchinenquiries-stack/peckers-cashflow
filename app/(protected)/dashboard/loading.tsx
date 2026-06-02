import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  FormCardSkeleton,
  TableSkeleton,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-6">
        <div className="lg:col-span-2">
          <FormCardSkeleton />
        </div>
        <div className="lg:col-span-3">
          <TableSkeleton rows={6} />
        </div>
      </div>
    </>
  );
}
