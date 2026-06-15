import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getVMSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_VM_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_VM_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing VM Analytics Supabase config. " +
      "Add NEXT_PUBLIC_VM_SUPABASE_URL and NEXT_PUBLIC_VM_SUPABASE_ANON_KEY to .env.local"
    );
  }

  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}
