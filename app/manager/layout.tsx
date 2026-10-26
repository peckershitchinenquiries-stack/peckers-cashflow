import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/TopBar";
import { isPeckersAppRequest } from "@/lib/is-native-app-server";
import { NativePushHandler } from "@/components/clock/NativePushHandler";
import { resolveActiveStoreId } from "@/lib/types";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["manager"]);
  const inApp = isPeckersAppRequest();

  // Managers can operate ANY store (multi-store). Load the full list so the
  // switcher can offer them all; the active one comes from their account.
  const supabase = createServerSupabase();
  const { data: storeRows } = await supabase
    .from("stores")
    .select("id, name")
    .order("name");
  const stores = storeRows ?? [];
  const homeStoreId = user.allowed?.store_id ?? null;
  const activeStoreId = resolveActiveStoreId(user.allowed);
  const userName = user.allowed?.name || user.email;

  return (
    <div className="min-h-screen flex bg-bg">
      <NativePushHandler fallbackHref="/manager/live" />
      <Sidebar
        portal="manager"
        userName={userName}
        stores={stores}
        activeStoreId={activeStoreId}
        homeStoreId={homeStoreId}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar
          portal="manager"
          userName={userName}
          stores={stores}
          activeStoreId={activeStoreId}
          homeStoreId={homeStoreId}
          inApp={inApp}
          avatarUrl={user.allowed?.avatar_url ?? null}
        />
        <main className="flex-1 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10 max-w-[1400px] w-full mx-auto app-screen">
          {children}
        </main>
        <BottomNav portal="manager" />
      </div>
    </div>
  );
}
