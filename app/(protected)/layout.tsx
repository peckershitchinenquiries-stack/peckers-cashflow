import { requireRole } from "@/lib/supabase-server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/TopBar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin"]);

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar portal="admin" userName={user.allowed?.name || user.email} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar portal="admin" userName={user.allowed?.name || user.email} />
        <main className="flex-1 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10 max-w-[1400px] w-full mx-auto app-screen">
          {children}
        </main>
        <BottomNav portal="admin" />
      </div>
    </div>
  );
}
