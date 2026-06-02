import { PageHeaderSkeleton, CardSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="space-y-4 max-w-2xl">
        <CardSkeleton className="h-28" />
        <CardSkeleton className="h-28" />
        <CardSkeleton className="h-28" />
      </div>
    </>
  );
}
