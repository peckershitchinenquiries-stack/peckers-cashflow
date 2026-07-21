import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/TopBar";
import { resolveActiveStoreId } from "@/lib/types";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["manager"]);

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
      <Sidebar
        portal="manager"
        userName={userName}
        stores={stores}
        activeStoreId={activeStoreId}
        homeStoreId={homeStoreId}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar
          userName={userName}
          stores={stores}
          activeStoreId={activeStoreId}
          homeStoreId={homeStoreId}
        />
        <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-24 md:pb-10 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
        <BottomNav portal="manager" />
      </div>
    </div>
  );
}
