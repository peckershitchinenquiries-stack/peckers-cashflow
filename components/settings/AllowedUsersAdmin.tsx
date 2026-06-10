"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { removeAllowedUser } from "@/app/actions/admin";
import { createAdminAccount } from "@/app/actions/accounts";
import type { AllowedUser } from "@/lib/types";

/**
 * Admin-user management. Admins log in with a real email created in the
 * Supabase dashboard; this card only whitelists/relabels them. Managers and
 * crew are provisioned from the Managers and Employees pages instead.
 */
export function AllowedUsersAdmin({
  initialUsers,
  currentUserEmail,
}: {
  initialUsers: AllowedUser[];
  currentUserEmail: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ email: string; password: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!email.trim()) return setError("Email is required");
    setBusy(true);
    try {
      const res = await createAdminAccount({ name: name.trim(), email: email.trim() });
      setCreated({ email: res.email, password: res.password });
      setEmail("");
      setName("");
      toast.success("Admin login created");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: AllowedUser) {
    if (u.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      toast.error("You cannot remove yourself");
      return;
    }
    if (!confirm(`Remove admin ${u.email}?`)) return;
    setRemovingId(u.id);
    try {
      await removeAllowedUser(u.id);
      toast.success("Admin removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Users</CardTitle>
        <CardDescription>
          Each owner gets their own admin login here — one shared admin panel and
          the same data for all; only the name (shown in the sidebar) differs. A
          login is created instantly with a generated password. (Managers &amp;
          crew are created on their own pages.)
        </CardDescription>
      </CardHeader>

      {created && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="text-sm font-medium text-gold">New admin login created</p>
          <p className="text-sm text-text-primary mt-1">
            Email: <span className="font-mono">{created.email}</span>
          </p>
          <p className="text-sm text-text-primary">
            Temporary password: <span className="font-mono">{created.password}</span>
          </p>
          <p className="text-xs text-text-muted mt-1">
            Share these now — the password isn&apos;t shown again. They sign in at /login.
          </p>
        </div>
      )}

      <form
        onSubmit={add}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mb-6"
      >
        <Input
          label="Name"
          placeholder="Owner's full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="email"
          label="Email"
          placeholder="owner@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" loading={busy} iconLeft={<PlusIcon size={16} />}>
          Create admin login
        </Button>
      </form>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u, i) => (
              <tr
                key={u.id}
                className={`${i % 2 === 0 ? "" : "bg-bg/50"} border-t border-border/60`}
              >
                <td className="px-3 py-3 break-all">
                  <div className="flex items-center gap-2">
                    <span>{u.email}</span>
                    {u.email.toLowerCase() === currentUserEmail.toLowerCase() && (
                      <Badge variant="gold" className="text-[10px]">You</Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">{u.name || "—"}</td>
                <td className="px-3 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(u)}
                    loading={removingId === u.id}
                    disabled={u.email.toLowerCase() === currentUserEmail.toLowerCase()}
                    className="text-text-muted hover:text-danger"
                    aria-label="Remove"
                  >
                    <TrashIcon size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
