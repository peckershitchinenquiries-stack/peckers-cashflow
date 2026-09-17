// SERVER-ONLY. Reads the upstream API key; never import this from a client
// component. (The `server-only` package isn't installed in this repo.)
import type { LiveGrossSalesResponse, LiveSalesResult } from "./types";

// Render's free tier cold-starts slowly on the first call.
const TIMEOUT_MS = 25_000;

function isLiveSalesResponse(v: unknown): v is LiveGrossSalesResponse {
  const r = v as LiveGrossSalesResponse | null;
  return (
    !!r &&
    typeof r.asOf === "string" &&
    !!r.totals &&
    typeof r.totals.grossSales === "number" &&
    Array.isArray(r.byStore) &&
    Array.isArray(r.timeline)
  );
}

export async function fetchLiveGrossSales(): Promise<LiveSalesResult> {
  const base = process.env.LIVE_SALES_API_BASE_URL;
  const key = process.env.LIVE_SALES_API_KEY;
  if (!base || !key) return { ok: false, reason: "not_configured" };

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/+$/, "")}/api/live/gross-sales`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "unauthorized", status: res.status };
  }
  if (!res.ok) return { ok: false, reason: "unavailable", status: res.status };

  try {
    const body: unknown = await res.json();
    if (!isLiveSalesResponse(body)) return { ok: false, reason: "bad_response" };
    return { ok: true, data: body };
  } catch {
    return { ok: false, reason: "bad_response" };
  }
}
