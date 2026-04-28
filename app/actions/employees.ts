"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

export async function createEmployee(input: {
  name: string;
  phone?: string | null;
  hourly_rate: number;
  joined_date?: string | null;
  notes?: string | null;
}) {
  await requireAllowed();
  const supabase = createServerSupabase();
  if (!input.name?.trim()) throw new Error("Name is required");
  if (!input.hourly_rate || input.hourly_rate <= 0)
    throw new Error("Hourly rate must be greater than 0");

  const { error } = await supabase.from("employees").insert({
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    hourly_rate: Number(input.hourly_rate),
    joined_date: input.joined_date || null,
    notes: input.notes?.trim() || null,
    is_active: true,
    bank_weekly_hours_limit: 20,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/employees");
  return { ok: true };
}

export async function updateEmployee(input: {
  id: string;
  name: string;
  phone?: string | null;
  hourly_rate: number;
  joined_date?: string | null;
  notes?: string | null;
}) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("employees")
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      hourly_rate: Number(input.hourly_rate),
      joined_date: input.joined_date || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/employees");
  return { ok: true };
}

export async function archiveEmployee(id: string, archive: boolean) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("employees")
    .update({ is_active: !archive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/employees");
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
  if (input.total_hours_worked == null || input.total_hours_worked < 0)
    throw new Error("Total hours must be a positive number");

  // Snapshot the hourly rate at log time
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("hourly_rate")
    .eq("id", input.employee_id)
    .maybeSingle();
  if (empErr || !emp) throw new Error("Employee not found");

  // Upsert by (employee_id, week_start_date)
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
    hourly_rate_snapshot: Number(emp.hourly_rate),
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

  revalidatePath("/employees");
  revalidatePath("/analytics");
  return { ok: true };
}

export async function deleteEmployeeHours(id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("employee_hours").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/employees");
  revalidatePath("/analytics");
  return { ok: true };
}
