import { requireRole } from "@/lib/supabase-server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/TopBar";
import { isPeckersAppRequest } from "@/lib/is-native-app-server";
import { NativePushHandler } from "@/components/clock/NativePushHandler";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["employee"]);
  const inApp = isPeckersAppRequest();

  return (
    <div className="min-h-screen flex bg-bg">
      <NativePushHandler fallbackHref="/employee/attendance" />
      <Sidebar portal="employee" userName={user.allowed?.name || user.email} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar
          portal="employee"
          userName={user.allowed?.name || user.email}
          inApp={inApp}
          avatarUrl={user.allowed?.avatar_url ?? null}
        />
        <main className="flex-1 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10 max-w-[1400px] w-full mx-auto app-screen">
          {children}
        </main>
        <BottomNav portal="employee" />
      </div>
    </div>
  );
}
