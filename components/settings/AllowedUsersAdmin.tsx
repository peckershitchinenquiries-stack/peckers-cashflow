"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import {
  addAllowedUser,
  removeAllowedUser,
  updateAllowedUserRole,
} from "@/app/actions/admin";
import type { AllowedUser } from "@/lib/types";

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
  const [role, setRole] = React.useState<"admin" | "manager">("manager");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Email is required");
    setBusy(true);
    try {
      await addAllowedUser({ email, name: name || null, role });
      setEmail("");
      setName("");
      setRole("manager");
      toast.success("User added to allowed list");
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
    if (!confirm(`Remove ${u.email} from allowed users?`)) return;
    setRemovingId(u.id);
    try {
      await removeAllowedUser(u.id);
      toast.success("User removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRemovingId(null);
    }
  }

  async function changeRole(u: AllowedUser, newRole: "admin" | "manager") {
    setUpdatingId(u.id);
    try {
      await updateAllowedUserRole({ id: u.id, role: newRole });
      toast.success("Role updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allowed Users</CardTitle>
        <CardDescription>
          Only emails listed here may sign in. Make sure to also create their auth user in
          Supabase Authentication.
        </CardDescription>
      </CardHeader>

      <form
        onSubmit={add}
        className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end mb-6"
      >
        <Input
          type="email"
          label="Email"
          placeholder="person@webcros.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Input
          label="Name"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </Select>
        <Button type="submit" loading={busy} iconLeft={<PlusIcon size={16} />}>
          Add user
        </Button>
      </form>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Role</th>
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
                <td className="px-3 py-3">
                  <Select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as any)}
                    disabled={
                      updatingId === u.id ||
                      u.email.toLowerCase() === currentUserEmail.toLowerCase()
                    }
                    className="h-9"
                  >
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </Select>
                </td>
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
