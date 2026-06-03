"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase";
import { clearMustChangePassword } from "@/app/actions/self";
import { signOutAction } from "@/app/actions/auth";
import type { Portal } from "@/lib/types";

/**
 * Full-screen forced password change. Shown via /change-password when a user is
 * still on the temporary password their manager/admin shared. Reuses the same
 * flow as the in-settings card (supabase.auth.updateUser -> clearMustChangePassword)
 * then routes to the user's portal home.
 */
export function ForcedPasswordChange({
  portal,
  portalHome,
}: {
  portal: Portal;
  portalHome: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      const cleared = await clearMustChangePassword();
      if (!cleared?.ok) {
        // Password changed, but the must-change flag couldn't be cleared —
        // navigating home would just bounce back here. Surface it instead.
        toast.error(
          "Password changed, but your account couldn't be updated. Please contact your admin.",
        );
        setBusy(false);
        return;
      }
      toast.success("Password updated");
      router.replace(portalHome);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="password"
        label="New password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password"
        hint="At least 8 characters."
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      <Input
        type="password"
        label="Confirm new password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        autoComplete="new-password"
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      <Button onClick={save} loading={busy} className="w-full">
        Set new password
      </Button>
      <form action={signOutAction}>
        <input type="hidden" name="portal" value={portal} />
        <button
          type="submit"
          className="w-full text-xs text-text-muted hover:text-gold transition-colors mt-1"
        >
          Sign out instead
        </button>
      </form>
    </div>
  );
}
