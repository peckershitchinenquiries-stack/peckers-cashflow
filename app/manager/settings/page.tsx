import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogoutIcon } from "@/components/ui/icons";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { signOutAction } from "@/app/actions/auth";
import { AppearanceCard } from "@/components/settings/AppearanceCard";
import { ChangePasswordCard } from "@/components/employee/ChangePasswordCard";
import { ContactEmailCard } from "@/components/accounts/ContactEmailCard";

export const dynamic = "force-dynamic";

export default async function ManagerSettingsPage() {
  const user = await requireRole(["manager"]);
  const supabase = createServerSupabase();
  const { data: store } = user.allowed?.store_id
    ? await supabase
        .from("stores")
        .select("name")
        .eq("id", user.allowed.store_id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader title="Settings" description="Your account and preferences." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AppearanceCard />
        <Card>
          <CardHeader>
            <CardTitle>Your Account</CardTitle>
            <CardDescription>Signed-in details</CardDescription>
          </CardHeader>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-text-muted">Name</dt>
            <dd className="col-span-2 text-text-primary">{user.allowed?.name || "—"}</dd>
            <dt className="text-text-muted">Username</dt>
            <dd className="col-span-2 text-text-primary">{user.allowed?.username || "—"}</dd>
            <dt className="text-text-muted">Store</dt>
            <dd className="col-span-2">
              <Badge variant="neutral">{store?.name ?? "—"}</Badge>
            </dd>
          </dl>
          <form action={signOutAction} className="mt-6">
            <input type="hidden" name="portal" value="manager" />
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
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ContactEmailCard initialEmail={user.allowed?.contact_email ?? null} />
        <ChangePasswordCard />
      </div>
    </>
  );
}
