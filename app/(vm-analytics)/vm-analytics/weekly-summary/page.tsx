import { getComparison, getExec, getWeeks, getWeeklySummaryInputs, getWeeklySummaryInputsForWeek } from "@/lib/vm-analytics/queries";
import { n, weekRange } from "@/lib/vm-analytics/format";
import { shortStore, STORES, resolveStore as resolveStoreParam } from "@/lib/vm-analytics/constants";
import { generateWeeklySummary, type WeeklySummaryInputs } from "@/lib/vm-analytics/weekly-summary";
import { Section } from "@/components/vm-analytics/Section";
import { PageTitle, EmptyWeek, ErrorState } from "@/components/vm-analytics/PageState";
import { WeeklySummaryForm } from "@/components/vm-analytics/WeeklySummaryForm";
import { WeeklySummaryTable } from "@/components/vm-analytics/WeeklySummaryTable";

export const dynamic = "force-dynamic";

export default async function WeeklySummaryPage({
  searchParams,
}: {
  searchParams: { week?: string; store?: string };
}) {
  let weekIso: string | null;
  let selectedStore: string | null;
  let weeks = [] as Awaited<ReturnType<typeof getWeeks>>;
  let weekEnd = "";

  try {
    weeks = await getWeeks(); 
    weekIso = searchParams.week ?? weeks[0]?.week_start_iso ?? null;
    if (!weekIso) return <EmptyWeek />;

    weekEnd = weeks.find((w) => w.week_start_iso === weekIso)?.week_end ?? "";
    selectedStore = resolveStoreParam(searchParams.store);
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  try {
    const [comparisonData, execData, inputsData] = await Promise.all([
      getComparison(weekIso),
      getExec(weekIso),
      selectedStore
        ? getWeeklySummaryInputs(selectedStore, weekIso).then((r) => r ? [r] : [])
        : getWeeklySummaryInputsForWeek(weekIso),
    ]);

    // net_sales: use the exec dashboard view (same source as Executive dashboard —
    // vm_v_store_comparison.net_sales has historically returned wrong values).
    // gross_sales: use the comparison view (exec view does not expose gross_sales).
    const execMap = new Map(execData.map((r) => [r.store, r]));
    const storeDataMap = new Map(
      STORES.map((store) => {
        const compRow = comparisonData.find((r) => r.store === store);
        const execRow = execMap.get(store);
        return [
          store,
          {
            gross_sales: n(compRow?.gross_sales),
            net_sales: n(execRow?.net_sales ?? compRow?.net_sales),
          },
        ];
      })
    );

    if (selectedStore) {
      const sales = storeDataMap.get(selectedStore as "Peckers Hitchin" | "Peckers Stevenage") || { gross_sales: 0, net_sales: 0 };
      const inputs = inputsData[0];

      if (!inputs) {
        return (
          <>
            <PageTitle
              title="Weekly Summary"
              subtitle={`${shortStore(selectedStore)} · ${weekRange(weekIso, weekEnd)}`}
            />
            <Section title="Getting Started">
              <div className="space-y-4">
                <p className="text-text-secondary">
                  No data entered yet for {shortStore(selectedStore)} this week.
                  Enter the operational costs below to generate your weekly summary.
                </p>
                <WeeklySummaryForm store={selectedStore} week={weekIso} />
              </div>
            </Section>
          </>
        );
      }

      const summary = generateWeeklySummary(sales, inputs as unknown as WeeklySummaryInputs);

      return (
        <div className="space-y-7">
          <PageTitle
            title="Weekly Summary"
            subtitle={`${shortStore(selectedStore)} · ${weekRange(weekIso, weekEnd)}`}
          />
          <Section title="Results">
            <WeeklySummaryTable data={summary} store={selectedStore} />
          </Section>
          <Section title="Manager Inputs">
            <WeeklySummaryForm
              store={selectedStore}
              week={weekIso}
              initialData={inputs}
            />
          </Section>
        </div>
      );
    } else {
      // Combined view
      const hitchinData = storeDataMap.get("Peckers Hitchin") || { gross_sales: 0, net_sales: 0 };
      const stevenageData = storeDataMap.get("Peckers Stevenage") || { gross_sales: 0, net_sales: 0 };

      const combinedSales = {
        gross_sales: hitchinData.gross_sales + stevenageData.gross_sales,
        net_sales: hitchinData.net_sales + stevenageData.net_sales,
      };

      const hitchinInputs = inputsData.find((i) => i.store === "Peckers Hitchin");
      const stevenageInputs = inputsData.find((i) => i.store === "Peckers Stevenage");

      const avgBudgetPct = (
        hVal: number | string | null | undefined,
        sVal: number | string | null | undefined,
      ): number | undefined => {
        const h = n(hVal);
        const s = n(sVal);
        if (hitchinInputs && stevenageInputs) return (h + s) / 2;
        if (hitchinInputs) return h || undefined;
        if (stevenageInputs) return s || undefined;
        return undefined;
      };

      const combinedInputs = {
        cogs: n(hitchinInputs?.cogs) + n(stevenageInputs?.cogs),
        cogs_hitchin: n(hitchinInputs?.cogs_hitchin) + n(stevenageInputs?.cogs_hitchin),
        fillings_and_samosas: n(hitchinInputs?.fillings_and_samosas) + n(stevenageInputs?.fillings_and_samosas),
        packaging_costs: n(hitchinInputs?.packaging_costs) + n(stevenageInputs?.packaging_costs),
        marketing: n(hitchinInputs?.marketing) + n(stevenageInputs?.marketing),
        labour_cost: n(hitchinInputs?.labour_cost) + n(stevenageInputs?.labour_cost),
        occupancy_cost: n(hitchinInputs?.occupancy_cost) + n(stevenageInputs?.occupancy_cost),
        aggregator_costs: n(hitchinInputs?.aggregator_costs) + n(stevenageInputs?.aggregator_costs),
        gross_margin_budget_pct: avgBudgetPct(
          hitchinInputs?.gross_margin_budget_pct,
          stevenageInputs?.gross_margin_budget_pct,
        ),
        labour_budget_pct: avgBudgetPct(
          hitchinInputs?.labour_budget_pct,
          stevenageInputs?.labour_budget_pct,
        ),
      };

      const missingStore = !hitchinInputs
        ? "Hitchin"
        : !stevenageInputs
        ? "Stevenage"
        : null;

      if (!hitchinInputs && !stevenageInputs) {
        return (
          <>
            <PageTitle
              title="Weekly Summary"
              subtitle={`Combined · ${weekRange(weekIso, weekEnd)}`}
            />
            <div className="grid grid-cols-2 gap-4">
              {STORES.map((store) => (
                <div key={store} className="vm-card p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-text-muted">{shortStore(store)}</div>
                  <div className="mt-2 text-sm text-text-muted">No data yet</div>
                </div>
              ))}
            </div>
            <div className="vm-card p-6">
              <p className="text-text-secondary text-center">
                No data available. Enter operational costs for Hitchin and Stevenage individually.
              </p>
            </div>
          </>
        );
      }

      const summary = generateWeeklySummary(combinedSales, combinedInputs);

      return (
        <div className="space-y-7">
          <PageTitle
            title="Weekly Summary"
            subtitle={`Combined (Hitchin + Stevenage) · ${weekRange(weekIso, weekEnd)}`}
          />

          <div className="grid grid-cols-2 gap-4">
            {STORES.map((store) => {
              const storeSales = storeDataMap.get(store) || { gross_sales: 0, net_sales: 0 };
              const storeInputs = inputsData.find((i) => i.store === store);
              return (
                <div key={store} className="vm-card p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-text-muted">{shortStore(store)}</div>
                  <div className="mt-2 flex justify-between items-end">
                    <div>
                      <div className="text-sm text-text-secondary">Net Sales</div>
                      <div className="text-xl font-semibold text-text-primary">£{storeSales.net_sales.toFixed(2)}</div>
                    </div>
                    {storeInputs
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Data entered ✓</span>
                      : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">No data yet</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {missingStore && (
            <div className="px-4 py-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-800">
              Warning: {missingStore} data has not been entered yet. The combined figures below are incomplete.
            </div>
          )}

          <Section title="Combined Results">
            <WeeklySummaryTable data={summary} />
          </Section>

          <Section title="Individual Store Data">
            <div className="space-y-4">
              {STORES.map((store) => {
                const storeInputs = inputsData.find((i) => i.store === store);
                const storeSales = storeDataMap.get(store) || { gross_sales: 0, net_sales: 0 };

                if (!storeInputs) {
                  return (
                    <div key={store} className="vm-card p-4">
                      <h4 className="font-semibold text-text-primary mb-2">{shortStore(store)}</h4>
                      <p className="text-sm text-text-muted">No data entered yet</p>
                    </div>
                  );
                }

                const storeSummary = generateWeeklySummary(storeSales, storeInputs as unknown as WeeklySummaryInputs);

                return (
                  <details key={store} className="vm-card p-4">
                    <summary className="cursor-pointer font-semibold text-text-primary">
                      {shortStore(store)} Details
                    </summary>
                    <div className="mt-4">
                      <WeeklySummaryTable data={storeSummary} store={store} />
                    </div>
                  </details>
                );
              })}
            </div>
          </Section>
        </div>
      );
    }
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Unknown error"} />;
  }
}
