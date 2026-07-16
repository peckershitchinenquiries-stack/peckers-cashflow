"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateOwnContactEmail } from "@/app/actions/self";
import { validateContactEmail } from "@/lib/credentials";

/**
 * Lets a manager or crew member set their OWN password-reset address.
 *
 * Everyone hired before migration 019 has none, and the admin won't know most of
 * these addresses — so this is usually the fastest way for the account to become
 * self-recoverable. Shown on the crew profile page and manager settings.
 */
export function ContactEmailCard({ initialEmail }: { initialEmail: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [busy, setBusy] = React.useState(false);

  const saved = (initialEmail ?? "").trim();
  const dirty = email.trim().toLowerCase() !== saved.toLowerCase();

  async function save() {
    const problem = validateContactEmail(email);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const res = await updateOwnContactEmail({ contact_email: email });
      setEmail(res.contact_email);
      toast.success("Email saved — you can now reset your own password");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password Reset Email</CardTitle>
        <CardDescription>
          If you forget your password, we&apos;ll email a reset link here. Use your
          own inbox — anyone who can read it can get into your account.
        </CardDescription>
      </CardHeader>

      {!saved && (
        <div className="mb-4 text-sm text-warning bg-warning/10 border border-warning/30 rounded-xl px-3 py-2.5">
          No email saved yet. Until you add one, only an admin can reset your
          password for you.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Input
            type="email"
            label="Email address"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button onClick={save} loading={busy} disabled={!dirty}>
          {saved ? "Update" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
