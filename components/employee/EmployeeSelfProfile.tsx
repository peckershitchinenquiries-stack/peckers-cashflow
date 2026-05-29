"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateOwnProfile } from "@/app/actions/self";
import type { Employee } from "@/lib/types";

export function EmployeeSelfProfile({ employee }: { employee: Employee }) {
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = React.useState(employee.phone ?? "");
  const [acctName, setAcctName] = React.useState(employee.bank_account_name ?? "");
  const [bankName, setBankName] = React.useState(employee.bank_name ?? "");
  const [acctNo, setAcctNo] = React.useState(employee.account_number ?? "");
  const [sortCode, setSortCode] = React.useState(employee.sort_code ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateOwnProfile({
        phone: phone || null,
        bank_account_name: acctName || null,
        bank_name: bankName || null,
        account_number: acctNo || null,
        sort_code: sortCode || null,
      });
      toast.success("Profile updated");
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
        <CardTitle>Contact & Bank Details</CardTitle>
        <CardDescription>Keep these up to date for payroll.</CardDescription>
      </CardHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="hidden sm:block" />
        <Input
          label="Account name"
          value={acctName}
          onChange={(e) => setAcctName(e.target.value)}
        />
        <Input
          label="Bank name"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
        <Input
          label="Account number"
          value={acctNo}
          onChange={(e) => setAcctNo(e.target.value)}
        />
        <Input
          label="Sort code"
          placeholder="00-00-00"
          value={sortCode}
          onChange={(e) => setSortCode(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={busy}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}
