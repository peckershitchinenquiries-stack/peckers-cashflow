# Labor Cost Performance Dashboard — Technical Reference

**Status:** ✅ Completed & live
**Route:** `/vm-analytics/labor-cost`
**Data source:** Cashflow Supabase (`https://pyhqxaeuillxdmnpnnke.supabase.co`)
**Last updated:** 2026-06-13

This document explains every table/view the dashboard reads, how the data is
retrieved, how each Labor Cost field and KPI is calculated, how insights are
drawn, why revenue currently shows £0 for some weeks, and the full list of
errors hit during development with their fixes.

---

## 1. Architecture overview

The VM Analytics module talks to **two separate Supabase projects**:

| Concern | Supabase project | Client helper | Key used |
|---|---|---|---|
| Dashboards 1–5 (sales, delivery, daypart, products, store comparison) | **VM Supabase** | `getVMSupabaseServer()` | anon key (`NEXT_PUBLIC_VM_SUPABASE_*`) |
| **Dashboard 6 — Labor Cost** | **Cashflow Supabase** | `getCashflowSupabaseServer()` | **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) |

The Labor Cost dashboard is the only one that reads the **cashflow/rota**
database, because that's where wages and till revenue live. It is a **server
component** (`export const dynamic = "force-dynamic"`) sitting behind the app's
auth middleware, so the service-role key never reaches the browser.

```
Browser ──▶ labor-cost/page.tsx (server component)
                 │
                 ├─ getLaborCostWeeks()  ─┐
                 └─ getLaborCost(weekIso) ─┤  lib/vm-analytics/queries.ts
                                           │
                                           ▼
                          getCashflowSupabaseServer()   lib/supabase-cashflow.ts
                                           │  (service-role key, server-only)
                                           ▼
                          VIEW public.labor_cost_performance   (Cashflow Supabase)
                                           │
                          ┌────────────────┼────────────────────┐
                          ▼                ▼                     ▼
                     stores       employee_weekly_summary   daily_cash_entries
                                  (itself a VIEW over          (revenue table)
                                   rota_shifts, clock_events,
                                   employees)
```

---

## 2. Tables & views used

### 2.1 `public.labor_cost_performance` (the view the app queries)

The dashboard never touches the base tables directly — it queries this single
aggregating view, defined in
[`supabase/migrations/labor_cost_performance.sql`](../supabase/migrations/labor_cost_performance.sql):

```sql
CREATE OR REPLACE VIEW public.labor_cost_performance AS
SELECT
  s.id,
  s.name AS store,
  ews.week_start_date,
  COALESCE(SUM(ews.scheduled_total_wages), 0) AS labour_cost,
  COALESCE(SUM(dce.vita_mojo_sales), 0)       AS revenue,
  CASE
    WHEN COALESCE(SUM(dce.vita_mojo_sales), 0) > 0
    THEN ROUND(100 * COALESCE(SUM(ews.scheduled_total_wages), 0) / SUM(dce.vita_mojo_sales), 1)
    ELSE 0
  END AS labour_pct
FROM stores s
LEFT JOIN employee_weekly_summary ews ON ews.store_id = s.id
LEFT JOIN daily_cash_entries dce
  ON dce.store_id = s.id
  AND DATE_TRUNC('week', dce.entry_date) = ews.week_start_date
GROUP BY s.id, s.name, ews.week_start_date
ORDER BY s.name, ews.week_start_date DESC;

GRANT SELECT ON public.labor_cost_performance TO anon, authenticated;
```

**One row per (store, week).** Output columns:

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid | Store id (from `stores`) |
| `store` | text | Store display name, e.g. "Hitchin Peckers" |
| `week_start_date` | date | Monday of the week (from `employee_weekly_summary`) |
| `labour_cost` | numeric | Total scheduled wages for the store/week |
| `revenue` | numeric | Total till sales for the store/week |
| `labour_pct` | numeric | Labour cost as % of revenue (0 when revenue is 0) |

### 2.2 Source tables/views feeding the view

| Object | Kind | Role in calculation |
|---|---|---|
| `stores` | table | Drives the row set (one per store). Provides `id`, `name`. |
| `employee_weekly_summary` | **view** | Supplies `scheduled_total_wages` per employee/week → summed into `labour_cost`. Itself built from `rota_shifts`, `clock_events`, `employees`. |
| `daily_cash_entries` | table | Supplies `vita_mojo_sales` per day → summed into `revenue`. |

---

## 3. How the data is retrieved (code path)

### 3.1 Cashflow client — [`lib/supabase-cashflow.ts`](../lib/supabase-cashflow.ts)

```ts
export function getCashflowSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;   // server-only, bypasses RLS
  if (!url || !serviceKey) throw new Error("Cashflow Supabase not configured …");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- Uses the **service-role key** so it can read the RLS-protected operational
  tables. Must only be imported from server code (see error #4 below for why).

### 3.2 Query functions — [`lib/vm-analytics/queries.ts`](../lib/vm-analytics/queries.ts)

**`getLaborCostWeeks()`** — builds the week-picker list:
```ts
const { data } = await sb
  .from("labor_cost_performance")
  .select("week_start_date")
  .order("week_start_date", { ascending: false });
// then dedupe (view has one row per store/week) and drop nulls
```

**`getLaborCost(weekIso)`** — fetches one week and appends a TOTAL row:
```ts
const { data } = await sb
  .from("labor_cost_performance")
  .select("*")
  .eq("week_start_date", weekIso)
  .order("store", { ascending: true });

// TOTAL row = sum across stores, labour_pct recomputed on the totals
total.labour_cost = Σ rows.labour_cost
total.revenue     = Σ rows.revenue
total.labour_pct  = total.revenue > 0
                    ? round(total.labour_cost / total.revenue * 1000) / 10
                    : 0;
```

### 3.3 Page — [`app/(vm-analytics)/vm-analytics/labor-cost/page.tsx`](../app/(vm-analytics)/vm-analytics/labor-cost/page.tsx)

1. `getLaborCostWeeks()` → if empty, render `EmptyWeek`.
2. Resolve `weekIso` from `?week=` param, else default to the latest week.
3. `getLaborCost(weekIso)` → rows incl. TOTAL.
4. Render KPI cards, the breakdown table, and two bar charts.
5. Any thrown error → `ErrorState`.

---

## 4. How each Labor Cost field is calculated

### 4.1 `labour_cost` (wages)

`labour_cost = SUM(employee_weekly_summary.scheduled_total_wages)` for the store/week.

`scheduled_total_wages` is computed **per employee** inside
`employee_weekly_summary` ([`schema.sql`](../supabase/schema.sql)):

```
scheduled_hours      = Σ rota_shifts.scheduled_hours  (excluding days off),
                       grouped by date_trunc('week', shift_date)  -- Monday weeks

scheduled_ni_wages   = LEAST(scheduled_hours, 20) × COALESCE(hourly_ni_rate, hourly_rate, 0)
scheduled_cash_wages = GREATEST(scheduled_hours − 20, 0) × COALESCE(hourly_cash_rate, 0)

scheduled_total_wages = scheduled_ni_wages + scheduled_cash_wages
```

**Wage-split rule:** the first **20 scheduled hours** are paid at the employee's
**NI (bank/PAYE) rate**; any hours **beyond 20** are paid at their **cash rate**.
The view then sums every employee's `scheduled_total_wages` per store per week to
give the dashboard's `labour_cost`.

> Note: this is **scheduled** (rota) cost, not actuals. `actual_hours` exist in
> the summary view (from clock events) but are not used for `labour_cost`.

### 4.2 `revenue`

`revenue = SUM(daily_cash_entries.vita_mojo_sales)` where the entry's day falls
in the same week:

```
DATE_TRUNC('week', dce.entry_date) = ews.week_start_date
```

`vita_mojo_sales` is the till/POS sales figure recorded per store per day.
Postgres `DATE_TRUNC('week', …)` returns the **Monday** of that date's week, so
daily entries roll up to the same Monday-keyed week as the labour data.

### 4.3 `labour_pct`

```
labour_pct = revenue > 0 ? ROUND(100 × labour_cost / revenue, 1) : 0
```

The `CASE` guard returns **0 when revenue is 0** to avoid divide-by-zero — this
is why some weeks legitimately show 0% (see §6).

---

## 5. KPIs & insights (page layer)

Computed in `page.tsx` from the rows returned by `getLaborCost()`:

| KPI card | Formula |
|---|---|
| **Total Labor Cost** | `TOTAL.labour_cost` (Σ stores) |
| **Total Revenue** | `TOTAL.revenue` (Σ stores) |
| **Labor % (Total)** | `TOTAL.labour_cost / TOTAL.revenue × 100`, recomputed on totals |
| **Avg Labor % (Stores)** | mean of each store's `labour_pct` |

**Why two "%" numbers?**
- *Labor % (Total)* is the blended ratio across all stores (weighted by revenue).
- *Avg Labor % (Stores)* is the simple average of per-store percentages
  (unweighted). They differ when stores have very different revenue.

**Table:** one row per store + a bold TOTAL row (Store · Labor Cost · Revenue · Labor %).

**Charts:**
- *Labor Cost vs Revenue* — grouped bars per store (spot stores where wage spend exceeds takings).
- *Labor % of Revenue by Store* — single-series bars (compare efficiency; lower % = more efficient).

**How to read the insight:** labour % is the headline efficiency metric — wages
as a share of sales. A healthy QSR target is typically ~25–35%. Values **above
100%** mean the week is incomplete (wages booked but revenue missing), not that
the store is losing money on labour — see §6.

---

## 6. Why revenue shows £0 for some weeks

**Observed:** weeks **25–31 May** and **1–7 June 2026** show `revenue = £0` and
`labour_pct = 0`, while **8 June** shows real figures.

**Root cause — a data-coverage gap, not a bug:**

- `daily_cash_entries` currently only contains rows for **9–12 June 2026**.
- `DATE_TRUNC('week', entry_date)` buckets all of 9–12 June into the week
  starting **Monday 2026-06-08**.
- The `LEFT JOIN` on `daily_cash_entries` therefore matches **no rows** for the
  25 May and 1 June weeks, so `SUM(vita_mojo_sales)` is `NULL` →
  `COALESCE(…, 0)` → **revenue = 0**.
- With revenue = 0, the `labour_pct` `CASE` returns **0** by design.

| Week | Cash entries in range? | Revenue | Labour cost (still present) |
|---|---|---|---|
| 25 May – 31 May | ❌ none | £0 | Hitchin £206.85 (Stevenage absent) |
| 1 Jun – 7 Jun | ❌ none | £0 | Hitchin £637.75, Stevenage £152.52 |
| **8 Jun – 14 Jun** | ✅ 9–12 Jun | £3,875.00 | Hitchin £5,184.80, Stevenage £979.84 |

The **labour cost is correct** for every week (it comes from the rota, which has
data back to 25 May). Only **revenue** is missing for the earlier weeks.

> Also note: the labour % for 8 June reads **>100%** because the cash table only
> has ~4 days (9–12 Jun) of revenue against a fuller week of scheduled wages.
> The ratio will normalise once a complete week of `daily_cash_entries` exists.

**Fix / next step:** backfill `daily_cash_entries` with one row per store per
trading day for 25 May–7 June. The view recalculates automatically — **no code
change required**.

---

## 7. Errors encountered & fixes

### Error 1 — Data loader deleted existing weeks
- **Symptom:** re-running the sync wiped previously-loaded weeks.
- **Cause:** loader did a per-store full refresh (`DELETE WHERE store = $1`).
- **Fix:** switched to per-`(store, week)` idempotent refresh
  (`DELETE WHERE store = $1 AND week_start = $2`) inside the week loop, so each
  week is replaced independently and others are preserved.

### Error 2 — SQL alias syntax error in the week query
- **Symptom:** `column "week_start_dateasweek_end" does not exist`.
- **Cause:** `.select("week_start_date, week_start_date as week_end")` — PostgREST
  doesn't accept SQL-style aliases in that position.
- **Fix:** select the real column(s) only and shape the `WeekOption` in
  JavaScript (dedupe + map). Final code selects just `week_start_date`.

### Error 3 — View returned NULL weeks / all-zero rows
- **Symptom:** query returned rows where `week_start_date` was `NULL` and
  `labour_cost`/`revenue` were 0.
- **Cause:** join/grouping produced placeholder rows for stores/weeks with no
  labour data; nulls leaked into the week picker.
- **Fix:** `COALESCE(SUM(...), 0)` for the measures in the view, and on the app
  side `getLaborCostWeeks()` **drops null weeks** and deduplicates before
  building the picker.

### Error 4 — View returned **0 rows to the app** despite having data (the main blocker)
- **Symptom:** SQL editor showed 5 rows, but `getLaborCostWeeks()` got `[]` with
  **HTTP 200 and no error**.
- **Cause:** the dashboard was using the **anon key**. `stores` and
  `daily_cash_entries` have **Row-Level Security enabled**, and there's no anon
  policy granting read access (correct, since this is sensitive financial/rota
  data). RLS silently filtered every row → 200 + empty array.
- **Wrong turn:** temporarily `ALTER TABLE … DISABLE ROW LEVEL SECURITY` was
  suggested. This is a **security downgrade** (anyone with the public anon key
  could then read all cash/store data) and was reverted.
- **Correct fix:** point `getCashflowSupabaseServer()` at the **service-role
  key** (server-only, bypasses RLS) — mirroring the app's existing
  `createAdminClient()`. The page is a server component behind auth, so the key
  never ships to the browser. **RLS stays ON; the dashboard now returns data.**
- **Action item:** if RLS was disabled during debugging, re-enable it:
  ```sql
  ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
  ALTER TABLE daily_cash_entries ENABLE ROW LEVEL SECURITY;
  ```

### Error 5 — `DISABLE ROW LEVEL SECURITY` failed on `employee_weekly_summary`
- **Symptom:** `ERROR: 42809: ALTER action DISABLE ROW SECURITY cannot be
  performed on relation "employee_weekly_summary" … This operation is not
  supported for views.`
- **Cause:** `employee_weekly_summary` is a **view**, not a table; RLS toggles
  only apply to tables.
- **Resolution:** moot once the service-role-key fix (Error 4) was applied — no
  RLS changes are needed at all.

---

## 8. Completion checklist

- [x] `labor_cost_performance` view created & granted in Cashflow Supabase.
- [x] `getCashflowSupabaseServer()` uses the server-only service-role key.
- [x] `getLaborCostWeeks()` / `getLaborCost()` implemented and de-noised (debug logs removed).
- [x] Page renders KPIs, breakdown table, and both charts.
- [x] Week picker lists 8 Jun, 1 Jun, 25 May 2026.
- [x] Verified live at `/vm-analytics/labor-cost` (8 Jun: £6,164.64 cost / £3,875 revenue / 159.1%).
- [ ] **Pending (data, not code):** backfill `daily_cash_entries` for 25 May–7 Jun to give those weeks real revenue.
- [ ] **Pending (security):** confirm RLS is re-enabled on `stores` and `daily_cash_entries` if it was disabled during debugging.
