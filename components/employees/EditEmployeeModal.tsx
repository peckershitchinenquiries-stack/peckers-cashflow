"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateEmployee } from "@/app/actions/employees";
import {
  EmployeeProfileForm,
  employeeToForm,
  validateEmployeeForm,
  type EmployeeFormState,
  type FormErrors,
} from "./EmployeeProfileForm";
import type { Employee, Store } from "@/lib/types";

export function EditEmployeeModal({
  employee,
  stores,
  onClose,
  onSaved,
}: {
  employee: Employee;
  stores: Store[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState<EmployeeFormState>(() =>
    employeeToForm(employee),
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const errs = validateEmployeeForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      await updateEmployee({
        id: employee.id,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        position: form.position || null,
        employment_start_date: form.employment_start_date || null,
        joined_date: form.employment_start_date || null,
        hourly_ni_rate: form.hourly_ni_rate ? Number(form.hourly_ni_rate) : null,
        hourly_cash_rate: form.hourly_cash_rate ? Number(form.hourly_cash_rate) : null,
        delivery_rate: form.delivery_rate ? Number(form.delivery_rate) : null,
        hourly_rate: Number(form.hourly_ni_rate || 0),
        store_id: form.store_id || null,
        bank_account_name: form.bank_account_name || null,
        bank_name: form.bank_name || null,
        account_number: form.account_number || null,
        sort_code: form.sort_code || null,
        employment_status: form.employment_status,
        notes: form.notes || null,
      });
      toast.success("Employee updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit — ${employee.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save Changes
          </Button>
        </>
      }
    >
      <EmployeeProfileForm
        form={form}
        setForm={setForm}
        errors={errors}
        stores={stores}
      />
    </Modal>
  );
}
