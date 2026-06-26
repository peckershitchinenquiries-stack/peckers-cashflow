import { getVMSupabaseServer } from "@/lib/vm-analytics/client";
import type { WeeklySummaryInputRow } from "@/lib/vm-analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vm-analytics/weekly-summary
 * Fetch manager-entered weekly summary inputs for a store and week
 * Query params: store (required), week (required)
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get("store");
    const week = searchParams.get("week");

    if (!store || !week) {
      return Response.json(
        { error: "Missing required params: store, week" },
        { status: 400 }
      );
    }

    const sb = getVMSupabaseServer();
    const { data, error } = await sb
      .from("weekly_summary_inputs")
      .select("*")
      .eq("store", store)
      .eq("week_start_iso", week)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch weekly summary inputs:", error);
      return Response.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    return Response.json({ data: data as WeeklySummaryInputRow | null });
  } catch (err) {
    console.error("GET /weekly-summary error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vm-analytics/weekly-summary
 * Insert new weekly summary entry
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const {
      store,
      week_start_iso,
      cogs,
      cogs_hitchin,
      fillings_and_samosas,
      packaging_costs,
      marketing,
      labour_cost,
      occupancy_cost,
      aggregator_costs,
      gross_margin_budget_pct,
      labour_budget_pct,
    } = body;

    if (!store || !week_start_iso) {
      return Response.json(
        { error: "Missing required fields: store, week_start_iso" },
        { status: 400 }
      );
    }

    const sb = getVMSupabaseServer();
    const { data, error } = await sb
      .from("weekly_summary_inputs")
      .insert({
        store,
        week_start_iso,
        cogs: cogs ? parseFloat(cogs) : null,
        cogs_hitchin: cogs_hitchin ? parseFloat(cogs_hitchin) : null,
        fillings_and_samosas: fillings_and_samosas ? parseFloat(fillings_and_samosas) : null,
        packaging_costs: packaging_costs ? parseFloat(packaging_costs) : null,
        marketing: marketing ? parseFloat(marketing) : null,
        labour_cost: labour_cost ? parseFloat(labour_cost) : null,
        occupancy_cost: occupancy_cost ? parseFloat(occupancy_cost) : null,
        aggregator_costs: aggregator_costs ? parseFloat(aggregator_costs) : null,
        gross_margin_budget_pct: gross_margin_budget_pct ? parseFloat(gross_margin_budget_pct) : null,
        labour_budget_pct: labour_budget_pct ? parseFloat(labour_budget_pct) : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert weekly summary inputs:", error);
      return Response.json(
        { error: "Failed to insert data" },
        { status: 500 }
      );
    }

    return Response.json({ data: data as WeeklySummaryInputRow });
  } catch (err) {
    console.error("POST /weekly-summary error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vm-analytics/weekly-summary
 * Update existing weekly summary entry
 * Query params: store (required), week (required)
 */
export async function PUT(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get("store");
    const week = searchParams.get("week");
    const body = await req.json();

    if (!store || !week) {
      return Response.json(
        { error: "Missing required params: store, week" },
        { status: 400 }
      );
    }

    const {
      cogs,
      cogs_hitchin,
      fillings_and_samosas,
      packaging_costs,
      marketing,
      labour_cost,
      occupancy_cost,
      aggregator_costs,
      gross_margin_budget_pct,
      labour_budget_pct,
    } = body;

    const sb = getVMSupabaseServer();
    const { data, error } = await sb
      .from("weekly_summary_inputs")
      .update({
        cogs: cogs ? parseFloat(cogs) : null,
        cogs_hitchin: cogs_hitchin ? parseFloat(cogs_hitchin) : null,
        fillings_and_samosas: fillings_and_samosas ? parseFloat(fillings_and_samosas) : null,
        packaging_costs: packaging_costs ? parseFloat(packaging_costs) : null,
        marketing: marketing ? parseFloat(marketing) : null,
        labour_cost: labour_cost ? parseFloat(labour_cost) : null,
        occupancy_cost: occupancy_cost ? parseFloat(occupancy_cost) : null,
        aggregator_costs: aggregator_costs ? parseFloat(aggregator_costs) : null,
        gross_margin_budget_pct: gross_margin_budget_pct ? parseFloat(gross_margin_budget_pct) : null,
        labour_budget_pct: labour_budget_pct ? parseFloat(labour_budget_pct) : null,
      })
      .eq("store", store)
      .eq("week_start_iso", week)
      .select()
      .single();

    if (error) {
      console.error("Failed to update weekly summary inputs:", error);
      return Response.json(
        { error: "Failed to update data" },
        { status: 500 }
      );
    }

    return Response.json({ data: data as WeeklySummaryInputRow });
  } catch (err) {
    console.error("PUT /weekly-summary error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
