import { PageHeaderSkeleton, CardSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CardSkeleton className="h-40" />
        <CardSkeleton className="h-40" />
        <CardSkeleton className="h-40" />
        <CardSkeleton className="h-40" />
      </div>
    </>
  );
}
