import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = {
  title: "Admin sign in · Peckers",
};

export default function AdminLoginPage() {
  return (
    <AuthShell
      badge="Admin Portal"
      title="Welcome back"
      subtitle="Sign in with your admin email to manage stores, staff and rotas."
      otherPortals={[
        { href: "/manager/login", label: "Manager login" },
        { href: "/employee/login", label: "Crew login" },
        { href: "/cover-driver/login", label: "Cover driver login", appOnly: true },
      ]}
    >
      <LoginForm portal="admin" />
    </AuthShell>
  );
}
