import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = {
  title: "Crew sign in · Peckers",
};

export default function EmployeeLoginPage() {
  return (
    <AuthShell
      badge="Crew Portal"
      title="Crew sign in"
      subtitle="Sign in to clock in/out and see your shifts. Use the username and password your manager gave you."
      otherPortals={[
        { href: "/login", label: "Admin login" },
        { href: "/manager/login", label: "Manager login" },
      ]}
    >
      <LoginForm portal="employee" />
    </AuthShell>
  );
}
