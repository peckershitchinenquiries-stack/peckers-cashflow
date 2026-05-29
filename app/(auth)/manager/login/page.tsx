import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = {
  title: "Manager sign in · Peckers",
};

export default function ManagerLoginPage() {
  return (
    <AuthShell
      badge="Manager Portal"
      title="Manager sign in"
      subtitle="Use the username and password your admin gave you."
      otherPortals={[
        { href: "/login", label: "Admin login" },
        { href: "/employee/login", label: "Crew login" },
      ]}
    >
      <LoginForm portal="manager" />
    </AuthShell>
  );
}
