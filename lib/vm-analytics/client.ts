import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * How long a VM read stays warm in Next's data cache.
 *
 * The VM project is a read-only mirror the extractor syncs WEEKLY, so every
 * dashboard re-fetching it on each navigation bought nothing but latency —
 * switching store or tab re-asked the same week-scoped question and waited on
 * a cross-region round trip for an answer that cannot have changed. A minute
 * is short enough that a sync landing mid-session still shows up promptly.
 */
export const VM_CACHE_SECONDS = 60;
export const VM_CACHE_TAG = "vm-analytics";

function isRead(init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

// Writes stay uncached; PostgREST reads carry their whole question in the URL,
// which is exactly what the data cache keys on.
const cachedFetch: typeof fetch = (input, init) =>
  fetch(
    input,
    isRead(init)
      ? { ...init, next: { revalidate: VM_CACHE_SECONDS, tags: [VM_CACHE_TAG] } }
      : init,
  );

/**
 * `cached: false` for the read side of a read-then-write, where a stale miss
 * would make the write pointless — the insights route's own cache table.
 */
export function getVMSupabaseServer({ cached = true }: { cached?: boolean } = {}) {
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
    global: cached ? { fetch: cachedFetch } : undefined,
  });
}
