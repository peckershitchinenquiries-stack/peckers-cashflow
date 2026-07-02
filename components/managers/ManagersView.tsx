"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { KeyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import {
  CredentialsModal,
  type Credentials,
} from "@/components/accounts/CredentialsModal";
import {
  createManagerAccount,
  resetAccountPassword,
  deleteAccount,
  updateManagerWage,
} from "@/app/actions/accounts";
import { formatGBP } from "@/lib/utils";
import type { AllowedUser, Store } from "@/lib/types";

export function ManagersView({
  managers,
  stores,
  provisioningReady,
}: {
  managers: AllowedUser[];
  stores: Store[];
  provisioningReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [showAdd, setShowAdd] = React.useState(false);
  const [name, setName] = React.useState("");
  const [storeId, setStoreId] = React.useState(stores[0]?.id ?? "");
  const [wage, setWage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const [credsTitle, setCredsTitle] = React.useState("Manager created");
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [wageEditing, setWageEditing] = React.useState<AllowedUser | null>(null);
  const [wageValue, setWageValue] = React.useState("");
  const [wageSaving, setWageSaving] = React.useState(false);

  const storeName = (id: string | null) =>
    stores.find((s) => s.id === id)?.name ?? "—";

  async function createManager() {
    if (!name.trim()) return toast.error("Enter a name");
    if (!storeId) return toast.error("Pick a store");
    setBusy(true);
    try {
      const res = await createManagerAccount({
        name: name.trim(),
        store_id: storeId,
        fixed_monthly_wage: wage.trim() ? Number(wage) : null,
      });
      setCredsTitle(`Manager “${name.trim()}” created`);
      setCreds({ username: res.username, password: res.password, loginUrl: res.loginUrl });
      setShowAdd(false);
      setName("");
      setWage("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function reset(m: AllowedUser) {
    if (!confirm(`Reset password for ${m.name || m.username}? The old password stops working.`)) return;
    setActingId(m.id);
    try {
      const res = await resetAccountPassword({ allowed_user_id: m.id });
      setCredsTitle(`New password for ${m.name || res.username}`);
      setCreds({ username: res.username, password: res.password, loginUrl: "/manager/login" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActingId(null);
    }
  }

  async function remove(m: AllowedUser) {
    if (!confirm(`Delete manager ${m.name || m.username}? Their login will stop working.`)) return;
    setActingId(m.id);
    try {
      await deleteAccount({ allowed_user_id: m.id });
      toast.success("Manager removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActingId(null);
    }
  }

  function openWage(m: AllowedUser) {
    setWageEditing(m);
    setWageValue(m.fixed_monthly_wage != null ? String(m.fixed_monthly_wage) : "");
  }

  async function saveWage() {
    if (!wageEditing) return;
    setWageSaving(true);
    try {
      await updateManagerWage({
        allowed_user_id: wageEditing.id,
        fixed_monthly_wage: wageValue.trim() ? Number(wageValue) : null,
      });
      toast.success("Monthly wage updated");
      setWageEditing(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setWageSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!provisioningReady && (
        <Card className="border-warning/40 bg-warning/5">
          <p className="text-sm text-warning">
            Account creation is disabled until{" "}
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is set in the
            server environment. Add it and redeploy to enable one-click logins.
          </p>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-text-muted">
          {managers.length} manager{managers.length === 1 ? "" : "s"}
        </p>
        <Button
          onClick={() => setShowAdd(true)}
          iconLeft={<PlusIcon size={16} />}
          disabled={!provisioningReady || stores.length === 0}
        >
          Add Manager
        </Button>
      </div>

      {managers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<KeyIcon />}
            title="No managers yet"
            description="Create a manager login and share the generated username & password."
            action={
              <Button
                onClick={() => setShowAdd(true)}
                iconLeft={<PlusIcon size={16} />}
                disabled={!provisioningReady || stores.length === 0}
              >
                Add Manager
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-3 py-2.5">Username</th>
                  <th className="text-left px-3 py-2.5">Store</th>
                  <th className="text-right px-3 py-2.5">Monthly wage</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {m.name || "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-text-subtle">
                      {m.username || m.email}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="neutral">{storeName(m.store_id)}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => openWage(m)}
                        className="tabular-nums text-text-primary hover:text-gold underline-offset-2 hover:underline"
                        title="Set fixed monthly wage (monitoring only)"
                      >
                        {m.fixed_monthly_wage != null ? (
                          <>
                            {formatGBP(m.fixed_monthly_wage)}
                            <span className="text-text-muted"> /mo</span>
                          </>
                        ) : (
                          <span className="text-text-muted">Set wage</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reset(m)}
                          loading={actingId === m.id}
                        >
                          Reset password
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(m)}
                          aria-label="Delete"
                          className="text-text-muted hover:text-danger"
                        >
                          <TrashIcon size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && (
        <Modal
          open
          onClose={() => setShowAdd(false)}
          title="Add Manager"
          description="A username & password will be generated to share with them."
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button onClick={createManager} loading={busy}>
                Create login
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              label="Manager name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Select
              label="Store *"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              label="Monthly wage (£, optional)"
              prefix="£"
              value={wage}
              onChange={(e) => setWage(e.target.value)}
              hint="Fixed salary shown on the live dashboard. Monitoring only — it never affects any pay calculation."
            />
          </div>
        </Modal>
      )}

      {wageEditing && (
        <Modal
          open
          onClose={() => setWageEditing(null)}
          title={`Monthly wage — ${wageEditing.name || wageEditing.username}`}
          description="Fixed salary shown on the live dashboard for monitoring. It never feeds a pay calculation. Leave blank to clear."
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setWageEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveWage} loading={wageSaving}>
                Save
              </Button>
            </>
          }
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            label="Monthly wage (£)"
            prefix="£"
            value={wageValue}
            onChange={(e) => setWageValue(e.target.value)}
            placeholder="e.g. 2400"
            autoFocus
          />
        </Modal>
      )}

      <CredentialsModal
        open={!!creds}
        onClose={() => setCreds(null)}
        title={credsTitle}
        credentials={creds}
      />
    </div>
  );
}
