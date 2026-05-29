import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { EmployeeSelfProfile } from "@/components/employee/EmployeeSelfProfile";
import { formatDDMMYYYY } from "@/lib/utils";
import type { Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireRole(["employee"]);
  const supabase = createServerSupabase();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email.toLowerCase()}`)
    .limit(1)
    .maybeSingle();

  if (!employee) {
    return (
      <>
        <PageHeader title="My Profile" />
        <Card>
          <p className="text-sm text-text-muted">
            Your login isn&apos;t linked to a crew profile yet.
          </p>
        </Card>
      </>
    );
  }

  const emp = employee as Employee;

  return (
    <>
      <PageHeader title="My Profile" description="Your details. You can update contact & bank info." />
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>Set by your manager</CardDescription>
          </CardHeader>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-text-muted">Name</dt>
            <dd className="col-span-2 text-text-primary">{emp.name}</dd>
            <dt className="text-text-muted">Position</dt>
            <dd className="col-span-2">
              <Badge variant="gold">{emp.position ?? "—"}</Badge>
            </dd>
            <dt className="text-text-muted">Start date</dt>
            <dd className="col-span-2 text-text-primary">
              {emp.employment_start_date ? formatDDMMYYYY(emp.employment_start_date) : "—"}
            </dd>
            <dt className="text-text-muted">Username</dt>
            <dd className="col-span-2 text-text-primary">{user.allowed?.username ?? "—"}</dd>
          </dl>
        </Card>

        <EmployeeSelfProfile employee={emp} />
      </div>
    </>
  );
}
