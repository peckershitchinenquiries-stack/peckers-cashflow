"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) {
    throw new Error("Not authorised");
  }
  return user;
}

export async function upsertCashEntry(input: {
  entry_date: string;
  cash_sales: number;
  supermarket_expenses: number;
  notes?: string | null;
  id?: string;
}) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();

  const payload = {
    entry_date: input.entry_date,
    cash_sales: Number(input.cash_sales) || 0,
    supermarket_expenses: Number(input.supermarket_expenses) || 0,
    notes: input.notes?.trim() || null,
    user_id: user.id,
    user_email: user.email,
  };

  // Single round-trip upsert — relies on the unique index on
  // (user_id, entry_date). Replaces the old select-then-insert/update.
  const { error } = await supabase
    .from("cash_entries")
    .upsert(payload, { onConflict: "user_id,entry_date" });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/entries");
  revalidatePath("/analytics");
  return { ok: true };
}

export async function updateCashEntry(input: {
  id: string;
  entry_date: string;
  cash_sales: number;
  supermarket_expenses: number;
  notes?: string | null;
}) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("cash_entries")
    .update({
      entry_date: input.entry_date,
      cash_sales: Number(input.cash_sales) || 0,
      supermarket_expenses: Number(input.supermarket_expenses) || 0,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/entries");
  revalidatePath("/analytics");
  return { ok: true };
}

export async function deleteCashEntry(id: string) {
  await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("cash_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/entries");
  revalidatePath("/analytics");
  return { ok: true };
}
