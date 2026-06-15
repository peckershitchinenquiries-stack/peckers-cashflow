"use client";

import * as React from "react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { POSITION_OPTIONS } from "@/lib/types";
import { ageFromDOB, minWageForAge } from "@/lib/compliance";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type {
  Employee,
  EmployeePosition,
  EmploymentStatus,
  Store,
} from "@/lib/types";

export type EmployeeFormState = {
  name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  position: EmployeePosition | "";
  employment_start_date: string;
  hourly_ni_rate: string;
  hourly_cash_rate: string;
  delivery_rate: string;
  store_id: string;
  bank_account_name: string;
  bank_name: string;
  account_number: string;
  sort_code: string;
  employment_status: EmploymentStatus;
  notes: string;
};

export function emptyEmployeeForm(): EmployeeFormState {
  return {
    name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    position: "",
    employment_start_date: "",
    hourly_ni_rate: "",
    hourly_cash_rate: "",
    delivery_rate: "",
    store_id: "",
    bank_account_name: "",
    bank_name: "",
    account_number: "",
    sort_code: "",
    employment_status: "active",
    notes: "",
  };
}

export function employeeToForm(emp: Employee): EmployeeFormState {
  return {
    name: emp.name ?? "",
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    date_of_birth: emp.date_of_birth ?? "",
    gender: emp.gender ?? "",
    position: (emp.position as EmployeePosition) ?? "",
    employment_start_date:
      emp.employment_start_date ?? emp.joined_date ?? "",
    hourly_ni_rate:
      emp.hourly_ni_rate != null
        ? String(emp.hourly_ni_rate)
        : emp.hourly_rate
          ? String(emp.hourly_rate)
          : "",
    hourly_cash_rate:
      emp.hourly_cash_rate != null ? String(emp.hourly_cash_rate) : "",
    delivery_rate: emp.delivery_rate != null ? String(emp.delivery_rate) : "",
    store_id: emp.store_id ?? "",
    bank_account_name: emp.bank_account_name ?? "",
    bank_name: emp.bank_name ?? "",
    account_number: emp.account_number ?? "",
    sort_code: emp.sort_code ?? "",
    employment_status: emp.employment_status ?? "active",
    notes: emp.notes ?? "",
  };
}

export type FormErrors = Partial<Record<keyof EmployeeFormState, string>>;

export function validateEmployeeForm(form: EmployeeFormState): FormErrors {
  const errs: FormErrors = {};
  if (!form.name.trim()) errs.name = "Required";
  if (!form.date_of_birth) errs.date_of_birth = "Required for minimum-wage compliance";
  if (!form.position) errs.position = "Required";
  if (!form.employment_start_date) errs.employment_start_date = "Required";
  if (!form.store_id) errs.store_id = "Assign to a store";
  if (!form.hourly_ni_rate || Number(form.hourly_ni_rate) <= 0)
    errs.hourly_ni_rate = "Must be > 0";
  if (!form.bank_account_name.trim()) errs.bank_account_name = "Required";
  if (!form.bank_name.trim()) errs.bank_name = "Required";
  if (!form.account_number.trim()) errs.account_number = "Required";
  if (!form.sort_code.trim()) errs.sort_code = "Required";
  return errs;
}

function calcLengthOfService(startISO: string): string {
  if (!startISO) return "";
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return "";
  const now = new Date();
  const years = (now.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return "";
  return `${years.toFixed(1)} years`;
}

export function EmployeeProfileForm({
  form,
  setForm,
  errors,
  stores,
  lockStore = false,
}: {
  form: EmployeeFormState;
  setForm: React.Dispatch<React.SetStateAction<EmployeeFormState>>;
  errors: FormErrors;
  stores: Store[];
  lockStore?: boolean;
}) {
  const set = <K extends keyof EmployeeFormState>(k: K, v: EmployeeFormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const service = calcLengthOfService(form.employment_start_date);

  // Indicative minimum-wage check (uses default bands; the configured bands
  // drive the authoritative alert/badge). Advisory only — never blocks saving.
  const mwBands = DEFAULT_SETTINGS.min_wage_bands;
  const mwAge = ageFromDOB(form.date_of_birth);
  const mwRequired = minWageForAge(mwAge, mwBands);
  const mwRate = Number(form.hourly_ni_rate || 0);
  const belowMinWage = mwRequired != null && mwRate > 0 && mwRate < mwRequired;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h4 className="text-xs uppercase tracking-wider text-text-muted mb-3">
          Personal
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Full name *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="optional"
          />
          <DatePicker
            label="Date of birth"
            required
            value={form.date_of_birth}
            onChange={(v) => set("date_of_birth", v)}
            error={errors.date_of_birth}
          />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="">(optional)</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </Select>
        </div>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wider text-text-muted mb-3">
          Role & Store
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Position *"
            value={form.position}
            onChange={(e) => set("position", e.target.value as EmployeePosition)}
            error={errors.position}
          >
            <option value="">Select…</option>
            {POSITION_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select
            label="Store *"
            value={form.store_id}
            onChange={(e) => set("store_id", e.target.value)}
            error={errors.store_id}
            disabled={lockStore}
          >
            <option value="">Select…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <DatePicker
            label="Employment start"
            required
            value={form.employment_start_date}
            onChange={(v) => set("employment_start_date", v)}
            error={errors.employment_start_date}
            hint={service ? `Length of service: ${service}` : undefined}
          />
          <Select
            label="Status"
            value={form.employment_status}
            onChange={(e) =>
              set("employment_status", e.target.value as EmploymentStatus)
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="left">Left</option>
          </Select>
        </div>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wider text-text-muted mb-3">
          Pay rates
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="number"
            step="0.01"
            min="0"
            label="Hourly NI rate *"
            prefix="£"
            value={form.hourly_ni_rate}
            onChange={(e) => set("hourly_ni_rate", e.target.value)}
            error={errors.hourly_ni_rate}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label="Hourly cash-in-hand rate"
            prefix="£"
            value={form.hourly_cash_rate}
            onChange={(e) => set("hourly_cash_rate", e.target.value)}
            hint="Leave blank if not applicable"
          />
          {form.position === "Driver" && (
            <Input
              type="number"
              step="0.01"
              min="0"
              label="Delivery rate (per delivery)"
              prefix="£"
              value={form.delivery_rate}
              onChange={(e) => set("delivery_rate", e.target.value)}
              hint="Paid per completed delivery, on top of hourly pay"
            />
          )}
        </div>
        {belowMinWage && mwAge != null && mwRequired != null && (
          <p className="text-xs text-danger mt-2">
            ⚠ £{mwRate.toFixed(2)}/h is below the minimum wage for age {mwAge}{" "}
            (£{mwRequired.toFixed(2)}/h, {mwBands.effective_label}). Allowed, but
            please confirm this is intentional.
          </p>
        )}
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wider text-text-muted mb-3">
          Bank details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Account name *"
            value={form.bank_account_name}
            onChange={(e) => set("bank_account_name", e.target.value)}
            error={errors.bank_account_name}
          />
          <Input
            label="Bank name *"
            value={form.bank_name}
            onChange={(e) => set("bank_name", e.target.value)}
            error={errors.bank_name}
          />
          <Input
            label="Account number *"
            value={form.account_number}
            onChange={(e) => set("account_number", e.target.value)}
            error={errors.account_number}
          />
          <Input
            label="Sort code *"
            placeholder="00-00-00"
            value={form.sort_code}
            onChange={(e) => set("sort_code", e.target.value)}
            error={errors.sort_code}
          />
        </div>
      </div>

      <Textarea
        label="Notes"
        rows={2}
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="(optional)"
      />
    </div>
  );
}
