import { requireRole } from "@/lib/supabase-server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/TopBar";

export default async function CoverDriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["cover_driver"]);

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar portal="cover_driver" userName={user.allowed?.name || user.email} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar portal="cover_driver" userName={user.allowed?.name || user.email} />
        <main className="flex-1 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10 max-w-[1400px] w-full mx-auto app-screen">
          {children}
        </main>
        <BottomNav portal="cover_driver" />
      </div>
    </div>
  );
}
