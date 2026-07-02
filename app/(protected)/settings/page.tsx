import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogoutIcon } from "@/components/ui/icons";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { signOutAction } from "@/app/actions/auth";
import { AllowedUsersAdmin } from "@/components/settings/AllowedUsersAdmin";
import { AppearanceCard } from "@/components/settings/AppearanceCard";
import { StoresAdmin } from "@/components/settings/StoresAdmin";
import { AuditLogList } from "@/components/settings/AuditLogList";
import { CashFlowSettingsCard } from "@/components/settings/CashFlowSettingsCard";
import { ShiftTimesSettingsCard } from "@/components/settings/ShiftTimesSettingsCard";
import { ChangePasswordCard } from "@/components/employee/ChangePasswordCard";
import { getAppSettings } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireRole(["admin"]);
  const supabase = createServerSupabase();
  const settings = await getAppSettings();

  const [storesRes, adminsRes, auditRes] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase
      .from("allowed_users")
      .select("*")
      .eq("role", "admin")
      .order("created_at"),
    supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="Account, stores, admin users, and audit log." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AppearanceCard />

        <Card>
          <CardHeader>
            <CardTitle>Your Account</CardTitle>
            <CardDescription>Signed-in details</CardDescription>
          </CardHeader>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-text-muted">Name</dt>
            <dd className="col-span-2 text-text-primary">
              {user.allowed?.name || "—"}
            </dd>
            <dt className="text-text-muted">Email</dt>
            <dd className="col-span-2 text-text-primary break-all">{user.email}</dd>
            <dt className="text-text-muted">Role</dt>
            <dd className="col-span-2">
              <Badge variant="gold">{user.allowed?.role || "—"}</Badge>
            </dd>
          </dl>

          <form action={signOutAction} className="mt-6">
            <input type="hidden" name="portal" value="admin" />
            <Button
              type="submit"
              variant="danger"
              iconLeft={<LogoutIcon size={16} />}
              className="w-full sm:w-auto"
            >
              Sign Out
            </Button>
          </form>
        </Card>
      </div>

      <div className="mt-6">
        <ChangePasswordCard />
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <CashFlowSettingsCard initial={settings} />
        <ShiftTimesSettingsCard initial={settings} />
        <StoresAdmin stores={storesRes.data ?? []} />
        <AllowedUsersAdmin
          initialUsers={adminsRes.data ?? []}
          currentUserEmail={user.email}
        />
        <AuditLogList entries={auditRes.data ?? []} />
      </div>
    </>
  );
}
