"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import { resolveActiveStoreId, type CoverDriverRecord } from "@/lib/types";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  if (user.allowed.role !== "admin" && user.allowed.role !== "manager") {
    throw new Error("Only managers and admins can manage cover driver records.");
  }
  return user;
}

function assertStoreAccess(user: SessionUser, storeId: string) {
  if (user.allowed!.role === "manager") {
    const activeStore = resolveActiveStoreId(user.allowed);
    if (!activeStore) throw new Error("No store assigned to your account.");
    if (storeId !== activeStore) {
      throw new Error("You can only manage cover driver records for the store you're managing.");
    }
  }
}

function revalidateCoverDrivers() {
  revalidatePath("/employees");
  revalidatePath("/manager/employees");
}

/**
 * Record a one-off payment to a part-time cover driver. `total_pay` is computed
 * in the DB (hours_worked * hourly_rate), so it is never trusted from the client.
 * Returns the fresh record so the client can update state immediately.
 */
export async function addCoverDriverRecord(input: {
  store_id: string;
  driver_name: string;
  work_date: string;
  hours_worked: number;
  hourly_rate: number;
}): Promise<{ ok: true; record: CoverDriverRecord }> {
  const user = await requireStaff();
  if (!input.store_id) throw new Error("Store is required");
  if (!input.driver_name?.trim()) throw new Error("Driver name is required");
  if (!input.work_date) throw new Error("Work date is required");

  const hours = Number(input.hours_worked);
  if (isNaN(hours) || hours <= 0) throw new Error("Hours worked must be greater than 0");
  const rate = Number(input.hourly_rate);
  if (isNaN(rate) || rate <= 0) throw new Error("Hourly rate must be greater than 0");

  assertStoreAccess(user, input.store_id);

  const supabase = createServerSupabase();
  const payload = {
    store_id: input.store_id,
    driver_name: input.driver_name.trim(),
    work_date: input.work_date,
    hours_worked: hours,
    hourly_rate: rate,
    created_by: user.id,
    created_by_name: user.allowed!.name ?? user.email,
  };

  const { data, error } = await supabase
    .from("cover_driver_records")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to add cover driver record");
  }

  await writeAudit({
    action: "create",
    entity: "cover_driver_record",
    entity_id: data.id,
    changes: payload,
  });

  revalidateCoverDrivers();
  return { ok: true, record: data as CoverDriverRecord };
}

/** Remove a cover driver record (staff, scoped to the record's store). */
export async function deleteCoverDriverRecord(id: string): Promise<{ ok: true; deletedId: string }> {
  const user = await requireStaff();
  const supabase = createServerSupabase();

  const { data: rec } = await supabase
    .from("cover_driver_records")
    .select("id, store_id")
    .eq("id", id)
    .maybeSingle();
  if (!rec) throw new Error("Cover driver record not found");
  assertStoreAccess(user, rec.store_id);

  const { error } = await supabase.from("cover_driver_records").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await writeAudit({ action: "delete", entity: "cover_driver_record", entity_id: id });
  revalidateCoverDrivers();
  return { ok: true, deletedId: id };
}
