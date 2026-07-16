import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createServerSupabase, requireRole } from "@/lib/supabase-server";
import { findEmployeeForUser } from "@/lib/employee-lookup";
import { EmployeeSelfProfile } from "@/components/employee/EmployeeSelfProfile";
import { ContactEmailCard } from "@/components/accounts/ContactEmailCard";
import { formatDDMMYYYY } from "@/lib/utils";
import type { Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireRole(["employee"]);
  const supabase = createServerSupabase();

  const employee = await findEmployeeForUser(supabase, user.id, user.email);

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

        <ContactEmailCard initialEmail={user.allowed?.contact_email ?? null} />

        <EmployeeSelfProfile employee={emp} />
      </div>
    </>
  );
}
