import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase-server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/TopBar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.allowed) redirect("/access-denied");

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar userName={user.allowed?.name || user.email} />
        <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-24 md:pb-10 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
