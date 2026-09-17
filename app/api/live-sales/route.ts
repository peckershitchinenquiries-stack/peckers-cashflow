import { getSessionUser } from "@/lib/supabase-server";
import { fetchLiveGrossSales } from "@/lib/live-sales/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  if (process.env.LIVE_SALES_ENABLED !== "true") {
    return Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const user = await getSessionUser();
  if (!user?.allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const result = await fetchLiveGrossSales();
  if (!result.ok) {
    // Upstream status/body stay in the server log only — never sent to the browser.
    console.error("[live-sales] upstream failure:", result.reason, result.status ?? "");
    return Response.json(
      { error: "Live sales data unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  return Response.json(result.data, { headers: NO_STORE });
}
