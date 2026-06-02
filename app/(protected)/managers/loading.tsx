import { PageHeaderSkeleton, GridCardsSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <GridCardsSkeleton count={4} />
    </>
  );
}
