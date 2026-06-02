import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </>
  );
}
