import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase-server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForcedPasswordChange } from "@/components/auth/ForcedPasswordChange";
import { PORTAL_HOME, type Portal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set your password · Peckers" };

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const role = (user.allowed?.role ?? null) as Portal | null;
  if (!role) redirect("/access-denied");

  return (
    <AuthShell
      badge="Security"
      title="Set your password"
      subtitle="Your account is using a temporary password. Choose a new password to continue."
    >
      <ForcedPasswordChange portal={role} portalHome={PORTAL_HOME[role]} />
    </AuthShell>
  );
}
