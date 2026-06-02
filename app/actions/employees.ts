"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import type { EmployeeHoursComputed, EmployeePosition, EmploymentStatus } from "@/lib/types";

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

export type EmployeeInput = {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  position?: EmployeePosition | null;
  employment_start_date?: string | null;
  joined_date?: string | null;
  hourly_ni_rate?: number | null;
  hourly_cash_rate?: number | null;
  hourly_rate?: number;
  store_id?: string | null;
  bank_account_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  sort_code?: string | null;
  employment_status?: EmploymentStatus;
  notes?: string | null;
};

function buildPayload(input: EmployeeInput) {
  const niRate = Number(input.hourly_ni_rate ?? input.hourly_rate ?? 0);
  // NOTE: we intentionally do NOT manage `email` or `auth_user_id` here — those
  // are the login linkage, set once by account provisioning (accounts.ts). The
  // profile form must never overwrite them.
  return {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    date_of_birth: input.date_of_birth || null,
    gender: input.gender?.trim() || null,
    position: input.position || null,
    employment_start_date:
      input.employment_start_date || input.joined_date || null,
    joined_date: input.joined_date || input.employment_start_date || null,
    hourly_ni_rate: input.hourly_ni_rate != null ? Number(input.hourly_ni_rate) : null,
    hourly_cash_rate:
      input.hourly_cash_rate != null && input.hourly_cash_rate !== ("" as unknown as number)
        ? Number(input.hourly_cash_rate)
        : null,
    hourly_rate: niRate || Number(input.hourly_rate ?? 0),
    store_id: input.store_id || null,
    bank_account_name: input.bank_account_name?.trim() || null,
    bank_name: input.bank_name?.trim() || null,
    account_number: input.account_number?.trim() || null,
    sort_code: input.sort_code?.trim() || null,
    employment_status: input.employment_status || "active",
    notes: input.notes?.trim() || null,
  };
}

export async function createEmployee(input: EmployeeInput) {
  await requireAllowed();
  const supabase = createServerSupabase();
  if (!input.name?.trim()) throw new Error("Name is required");
  const ni = Number(input.hourly_ni_rate ?? input.hourly_rate ?? 0);
  if (!ni || ni <= 0) throw new Error("Hourly NI rate must be greater than 0");
  if (!input.position) throw new Error("Position is required");
  if (!input.store_id) throw new Error("Store assignment is required");

  const payload = {
    ...buildPayload(input),
    is_active: input.employment_status !== "left" && input.employment_status !== "inactive",
    bank_weekly_hours_limit: 20,
  };

  const { data, error } = await supabase
    .from("employees")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "create",
    entity: "employee",
    entity_id: data?.id ?? null,
    changes: payload,
  });

  revalidatePath("/employees");
  revalidatePath("/rota");
  return { ok: true, id: data?.id };
}

export async function updateEmployee(input: EmployeeInput) {
  if (!input.id) throw new Error("Missing employee id");
  await requireAllowed();
  const supabase = createServerSupabase();

  const payload = {
    ...buildPayload(input),
    is_active:
      input.employment_status === "left" || input.employment_status === "inactive"
        ? false
        : true,
  };

  const { error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "update",
    entity: "employee",
    entity_id: input.id,
    changes: payload,
  });

  revalidatePath("/employees");
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}

export async function archiveEmployee(id: string, archive: boolean) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("employees")
    .update({
      is_active: !archive,
      employment_status: archive ? "inactive" : "active",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({
    action: archive ? "archive" : "restore",
    entity: "employee",
    entity_id: id,
  });
  revalidatePath("/employees");
  revalidatePath("/rota");
  return { ok: true };
}

export async function reassignEmployeeStore(id: string, store_id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("employees")
    .update({ store_id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({
    action: "reassign_store",
    entity: "employee",
    entity_id: id,
    changes: { store_id },
  });
  revalidatePath("/employees");
  revalidatePath("/rota");
  revalidatePath("/live");
  return { ok: true };
}

export async function logEmployeeHours(input: {
  employee_id: string;
  week_start_date: string;
  total_hours_worked: number;
  notes?: string | null;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  if (!input.employee_id) throw new Error("Select an employee");
  if (!input.week_start_date) throw new Error("Week start date required");
  if (
    input.total_hours_worked == null ||
    input.total_hours_worked <= 0 ||
    isNaN(Number(input.total_hours_worked))
  )
    throw new Error("Hours must be greater than 0");

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("hourly_rate, hourly_ni_rate")
    .eq("id", input.employee_id)
    .maybeSingle();
  if (empErr || !emp) throw new Error("Employee not found");

  const rate = Number(emp.hourly_ni_rate ?? emp.hourly_rate ?? 0);

  const { data: existing } = await supabase
    .from("employee_hours")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("week_start_date", input.week_start_date)
    .maybeSingle();

  const payload = {
    employee_id: input.employee_id,
    week_start_date: input.week_start_date,
    total_hours_worked: Number(input.total_hours_worked),
    hourly_rate_snapshot: rate,
    notes: input.notes?.trim() || null,
    logged_by: user.id,
  };

  if (existing) {
    const { error } = await supabase
      .from("employee_hours")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("employee_hours").insert(payload);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    action: existing ? "update" : "create",
    entity: "employee_hours",
    entity_id: existing?.id ?? input.employee_id,
    changes: payload,
  });

  // Fetch the fresh computed rows so the client can update state immediately
  // without waiting for the router cache to clear.
  const { data: freshHours } = await supabase
    .from("employee_hours_computed")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(500);

  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/analytics");
  return { ok: true, hours: (freshHours ?? []) as EmployeeHoursComputed[] };
}

export async function deleteEmployeeHours(id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("employee_hours").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({ action: "delete", entity: "employee_hours", entity_id: id });
  revalidatePath("/employees");
  revalidatePath("/manager/employees");
  revalidatePath("/analytics");
  return { ok: true, deletedId: id };
}
