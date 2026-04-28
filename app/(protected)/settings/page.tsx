import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogoutIcon } from "@/components/ui/icons";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { signOutAction } from "@/app/actions/auth";
import { AllowedUsersAdmin } from "@/components/settings/AllowedUsersAdmin";
import { AppearanceCard } from "@/components/settings/AppearanceCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const isAdmin = user.allowed?.role === "admin";

  let allowedUsers: any[] = [];
  if (isAdmin) {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("allowed_users")
      .select("*")
      .order("created_at", { ascending: true });
    allowedUsers = data ?? [];
  }

  return (
    <>
      <PageHeader title="Settings" description="Account and app information." />

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
              <Badge variant={isAdmin ? "gold" : "neutral"}>
                {user.allowed?.role || "—"}
              </Badge>
            </dd>
          </dl>

          <form action={signOutAction} className="mt-6">
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

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>Internal cash flow management</CardDescription>
          </CardHeader>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-text-muted">App</dt>
            <dd className="col-span-2 text-text-primary">Peckers Cash Flow</dd>
            <dt className="text-text-muted">Version</dt>
            <dd className="col-span-2 text-text-primary">1.0.0</dd>
            <dt className="text-text-muted">Built by</dt>
            <dd className="col-span-2 text-gold font-medium">WEBCROS</dd>
          </dl>
          <p className="text-xs text-text-muted mt-6">
            This is an internal tool. Access is restricted to whitelisted users.
          </p>
        </Card>
      </div>

      {isAdmin && (
        <div className="mt-6">
          <AllowedUsersAdmin
            initialUsers={allowedUsers}
            currentUserEmail={user.email}
          />
        </div>
      )}
    </>
  );
}
