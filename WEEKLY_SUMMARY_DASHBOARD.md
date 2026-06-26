# Weekly Summary Dashboard — Build Instructions

## Overview

A **Weekly Summary** dashboard already exists in the codebase but is **broken and not yet wired into the navigation**. This document explains exactly what needs to be fixed and built so Claude Code can complete the implementation.

The dashboard lives at `/vm-analytics/weekly-summary` and shows a P&L-style table (Gross Sales → Net Margin) for a selected store and week. Some row values come from Supabase (Gross Sales, Net Sales); others are entered manually by the manager once per week and saved to Supabase; the rest are derived via formulas.

---

## What Already Exists (do NOT recreate)

| File | Status |
|------|--------|
| `app/(vm-analytics)/vm-analytics/weekly-summary/page.tsx` | Exists — review and fix |
| `app/api/vm-analytics/weekly-summary/route.ts` | Exists — GET/POST/PUT, correct |
| `components/vm-analytics/WeeklySummaryForm.tsx` | Exists — review and fix |
| `components/vm-analytics/WeeklySummaryTable.tsx` | Exists — review and fix |
| `lib/vm-analytics/weekly-summary.ts` | Exists — calculation logic, correct |

---

## Step 1 — Add `WeeklySummaryInputRow` to `lib/vm-analytics/types.ts`

This type is imported in `WeeklySummaryForm.tsx` but **not defined in `types.ts`**. Add it at the end of the file:

```ts
// Row from the `weekly_summary_inputs` Supabase table.
// Numeric columns arrive as strings via PostgREST.
export interface WeeklySummaryInputRow {
  id?: number;
  store: string;
  week_start_iso: string;
  cogs?: number | string | null;
  cogs_hitchin?: number | string | null;
  fillings_and_samosas?: number | string | null;
  packaging_costs?: number | string | null;
  marketing?: number | string | null;
  labour_cost?: number | string | null;
  occupancy_cost?: number | string | null;
  aggregator_costs?: number | string | null;
  gross_margin_budget_pct?: number | string | null;
  labour_budget_pct?: number | string | null;
  created_at?: string;
  updated_at?: string;
}
```

---

## Step 2 — Add Query Functions to `lib/vm-analytics/queries.ts`

The page imports `getWeeklySummaryInputs` and `getWeeklySummaryInputsForWeek` from queries but **these functions do not exist**. Add them at the end of `queries.ts`:

Also add `WeeklySummaryInputRow` to the import list at the top of `queries.ts`.

```ts
import type { WeeklySummaryInputRow } from "@/lib/vm-analytics/types";

/**
 * Fetch manager-entered inputs for a single store + week.
 * Returns null if no data has been entered yet.
 */
export async function getWeeklySummaryInputs(
  store: string,
  weekIso: string,
): Promise<WeeklySummaryInputRow | null> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("weekly_summary_inputs")
    .select("*")
    .eq("store", store)
    .eq("week_start_iso", weekIso)
    .maybeSingle();
  if (error) throw new Error(`getWeeklySummaryInputs: ${error.message}`);
  return data as WeeklySummaryInputRow | null;
}

/**
 * Fetch manager-entered inputs for ALL stores for a given week.
 * Used in the combined / "all stores" view.
 */
export async function getWeeklySummaryInputsForWeek(
  weekIso: string,
): Promise<WeeklySummaryInputRow[]> {
  const sb = getVMSupabaseServer();
  const { data, error } = await sb
    .from("weekly_summary_inputs")
    .select("*")
    .eq("week_start_iso", weekIso);
  if (error) throw new Error(`getWeeklySummaryInputsForWeek: ${error.message}`);
  return (data ?? []) as WeeklySummaryInputRow[];
}
```

---

## Step 3 — Register Dashboard in Navigation

In `lib/vm-analytics/constants.ts`:

### 3a. Extend the `DashboardKey` union type

```ts
export type DashboardKey =
  | "weekly-exception"
  | "executive"
  | "products"
  | "daypart"
  | "delivery"
  | "store-comparison"
  | "weekly-summary"   // ADD THIS
  | "labor-cost";
```

### 3b. Add entry to `DASHBOARDS` array

Insert after the `store-comparison` entry (before `labor-cost`):

```ts
{
  key: "weekly-summary",
  href: "/vm-analytics/weekly-summary",
  title: "Weekly Summary",
  blurb: "Manager P&L: costs, margins & net margin by store",
},
```

---

## Step 4 — Create the Supabase Table

If the `weekly_summary_inputs` table does not already exist in the VM Analytics Supabase project, run this SQL:

```sql
create table if not exists weekly_summary_inputs (
  id                      bigserial primary key,
  store                   text not null,
  week_start_iso          text not null,
  cogs                    numeric,
  cogs_hitchin            numeric,
  fillings_and_samosas    numeric,
  packaging_costs         numeric,
  marketing               numeric,
  labour_cost             numeric,
  occupancy_cost          numeric,
  aggregator_costs        numeric,
  gross_margin_budget_pct numeric,
  labour_budget_pct       numeric,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique (store, week_start_iso)
);
```

The `unique (store, week_start_iso)` constraint means each store has exactly one row per week — the PUT endpoint updates it, the POST endpoint creates it.

---

## Step 5 — Fix and Complete `app/(vm-analytics)/vm-analytics/weekly-summary/page.tsx`

The page has the right shape but needs these corrections:

### 5a. Remove unused import

The page imports `resolveStore` from `queries` — this function does not exist there. Remove it from the queries import. The page only needs `resolveStore` from constants (already aliased as `resolveStoreParam`).

Fix the import line:
```ts
// BEFORE (broken):
import { getComparison, resolveStore, getWeeks, getWeeklySummaryInputs, getWeeklySummaryInputsForWeek } from "@/lib/vm-analytics/queries";

// AFTER (correct):
import { getComparison, getWeeks, getWeeklySummaryInputs, getWeeklySummaryInputsForWeek } from "@/lib/vm-analytics/queries";
```

### 5b. UX: Show form and table together, not separately

When a single store is selected AND data already exists, the page should show:
- The results table at the top (so the manager sees the summary immediately)
- An "Edit" button that reveals the form inline below the table

When no data exists for the selected week/store, show the form prominently with a clear message: "No data entered yet for [Store] this week. Enter values below."

### 5c. Combined view: handle `cogs_hitchin` correctly

For the combined view (no store selected), each store's `cogs_hitchin` represents costs from the other store. When combining both stores, sum both `cogs_hitchin` values — they are additive in the P&L.

### 5d. Combined view: budget percentages

For the combined view, average the `gross_margin_budget_pct` and `labour_budget_pct` from both stores (rather than using only Hitchin's). If only one store has data, use that store's values.

### 5e. Week selector default: last completed week

The week selector already defaults to the most recent available week from Supabase (`weeks[0]`). This is correct — it is last week by design (current/in-progress weeks are excluded from `vm_v_available_weeks`).

### 5f. Data freshness: allow viewing future/past weeks

The manager should be able to select any week from the week picker and enter or view data for that week. There is no restriction on which week can be selected.

---

## Step 6 — Fix `components/vm-analytics/WeeklySummaryForm.tsx`

### 6a. COGS Hitchin label

The form currently derives the label using `getOtherStore()`. The label in the form should be:
- If viewing **Stevenage**: label the field **"COGS Hitchin"**
- If viewing **Hitchin**: label the field **"COGS Stevenage"**

This matches the P&L table entity names.

### 6b. Budget percentage input: accept whole numbers

The budget % fields (Gross Margin Budget %, Labour Budget %) should accept values entered as whole numbers (e.g. `65`) and automatically convert to decimals (e.g. `0.65`) before saving. Display the stored decimal value as a whole number in the input.

Logic: if manager types `65`, store `0.65`. If they type `0.65`, store `0.65` (detect: if value > 1 divide by 100, otherwise store as-is).

Add helper text below each budget % input: *"Enter as a whole number, e.g. 65 for 65%"*

### 6c. Show "Edit" button even when no initial data

If `initialData` is null and the form is in editing mode, still show a "Cancel" link that navigates back (or just collapses the form if the table is already visible).

### 6d. Save callback triggers page refresh

After a successful save (POST or PUT), the page should reload to show the updated summary table. The form already calls `onSave?.(data)`. The page component should handle this by passing a callback that triggers `router.refresh()` (use Next.js `useRouter` from `next/navigation` in a client wrapper, or simply make the save trigger a full reload via `window.location.reload()`).

Since the page is a Server Component and the form is a Client Component, the cleanest approach is: after save, call `window.location.reload()` in the form's `handleSave` success branch.

---

## Step 7 — Fix `components/vm-analytics/WeeklySummaryTable.tsx`

### 7a. Table layout matching the reference design

The table must have exactly 4 columns: **Entity | Actual | Budget | Variance**

Each row with a percentage sub-value should show it on a second line below the currency value (already implemented — keep this behaviour).

Row grouping (bold/highlighted rows): **Gross Sales, Net Sales, Gross Margin, Store Contribution, Net Margin** should be bold/highlighted. All other rows are plain.

### 7b. Variance colour coding

- Labour variance negative (actual > budget) → red
- Labour variance positive (budget > actual) → green
- Gross Margin variance positive → green, negative → red
- All other variances: positive → green, negative → red

### 7c. Show "—" for missing values

If a field has no budget or variance (e.g. COGS, Packaging Costs, Marketing, Occupancy Costs, Aggregator Costs, Gross Sales, Net Sales), show "—" in those columns. Already implemented — verify it renders correctly.

---

## Step 8 — Verify Calculation Logic in `lib/vm-analytics/weekly-summary.ts`

The file already exists and is correct. Here is the authoritative formula reference for verification:

| Entity | Actual | Actual % | Budget | Budget % | Variance | Variance % |
|--------|--------|----------|--------|----------|----------|------------|
| Gross Sales | from Supabase | — | — | — | — | — |
| Net Sales | from Supabase | — | — | — | — | — |
| COGS | manager input | — | — | — | — | — |
| COGS Hitchin | manager input (other store) | — | — | — | — | — |
| Fillings and Samosas | manager input | — | — | — | — | — |
| **Gross Margin** | Net Sales – COGS + COGS Hitchin + Fillings & Samosas | actual / Net Sales | budget_pct × Net Sales | budget_pct | actual – budget | actual% – budget% |
| Packaging Costs | manager input | — | — | — | — | — |
| Marketing | manager input | — | — | — | — | — |
| **Labour** | manager input | actual / Net Sales | budget_pct × Net Sales | budget_pct | budget – actual | budget% – actual% |
| Occupancy Costs | manager input | actual / Net Sales | — | — | — | — |
| **Store Contribution** | Gross Margin – Labour – Occupancy – Packaging | actual / Net Sales | — | — | — | — |
| Aggregator Costs | manager input | — | — | — | — | — |
| **Net Margin** | Store Contribution – Aggregator Costs | actual / **Gross Sales** | — | — | — | — |

**Important notes:**
- Net Margin % uses **Gross Sales** as denominator (not Net Sales) — this is intentional
- Labour variance = Budget – Actual (reversed sign vs other rows) because overspend is negative
- Do not round percentages — show full decimal precision (e.g. 65.73%, not 65.70%)
- Budget % for Gross Margin and Labour are stored as decimals (0.65 = 65%) — display as e.g. `65%`

---

## Step 9 — Manual Data Entry UX Flow

### First visit for a new week (no data yet)

1. Manager opens Weekly Summary, selects store (Hitchin or Stevenage)
2. If no data exists for that store+week: show a card with message and an open form
3. Manager fills in all required fields and clicks **Save**
4. Page reloads and shows the full results table with an **Edit** button

### Subsequent visits that week (data already saved)

1. Manager opens Weekly Summary — table is shown immediately
2. An **Edit** button (top-right of the results section) opens the form in edit mode
3. Manager updates values and clicks **Save** (PUT request updates the row)
4. Page reloads and shows the updated table

### Combined view (no store selected / "All Stores")

- Shows two status cards: Hitchin and Stevenage, each with "Data entered ✓" or "No data yet"
- If both stores have data: shows the combined results table below the cards
- If one store is missing: shows the combined table with available data and a warning banner that one store's data is missing
- Does NOT show input forms — manager must select individual stores to enter data

---

## Step 10 — Store-Specific Behaviour

The `cogs_hitchin` field name is fixed (it is the column name in Supabase). The label in the UI changes based on the selected store:

| Selected store | Field label in form | Entity name in table |
|---------------|---------------------|----------------------|
| Stevenage | COGS Hitchin | COGS Hitchin |
| Hitchin | COGS Stevenage | COGS Hitchin *(stored column name stays the same)* |

> **Note to Claude Code:** The Supabase column is always `cogs_hitchin` regardless of selected store. When Hitchin is selected, the manager is entering the cost from the Stevenage side into the same column. The entity name in the P&L table should reflect the actual store name (i.e. show "COGS Stevenage" when viewing Hitchin). Update `WeeklySummaryTable` to accept the selected store and render the correct label.

---

## Summary of Files to Create or Modify

| File | Action |
|------|--------|
| `lib/vm-analytics/types.ts` | **ADD** `WeeklySummaryInputRow` interface |
| `lib/vm-analytics/queries.ts` | **ADD** `getWeeklySummaryInputs` and `getWeeklySummaryInputsForWeek` functions + import |
| `lib/vm-analytics/constants.ts` | **ADD** `"weekly-summary"` to `DashboardKey` union and `DASHBOARDS` array |
| `app/(vm-analytics)/vm-analytics/weekly-summary/page.tsx` | **FIX** import, UX flow, combined view logic |
| `components/vm-analytics/WeeklySummaryForm.tsx` | **FIX** label, budget % input, save callback |
| `components/vm-analytics/WeeklySummaryTable.tsx` | **FIX** COGS Hitchin label, verify layout |
| Supabase (run SQL manually) | **CREATE** `weekly_summary_inputs` table if not exists |

---

## Notes for Claude Code

- Do **not** modify any other dashboards or shared components beyond what is listed above
- The existing `WeeklySummaryTable`, `WeeklySummaryForm`, and `weekly-summary.ts` are substantially correct — fix only what is listed
- Use the existing design system classes (`vm-card`, `text-text-primary`, `text-text-muted`, `bg-surface-hover`, etc.) — do not introduce new CSS
- The `format.ts` helpers (`gbp`, `pct`, `n`) are available — use them for consistency
- All pages in this module use `export const dynamic = "force-dynamic"` — keep this on the weekly summary page
- The Supabase client for VM Analytics is `getVMSupabaseServer()` from `@/lib/vm-analytics/client` — use this, not the cashflow Supabase client
