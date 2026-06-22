# YoY Comparison — Executive Dashboard Implementation Plan

> **Goal:** Add Year-on-Year (YoY) KPI comparisons to the Executive Dashboard, mirroring the existing Week-on-Week (WoW) pattern. The YoY baseline comes from three uploaded Excel sheets covering historical weekly sales data for Hitchin, Stevenage, and both stores combined.

---

## Overview of Changes

| Area | What changes |
|------|-------------|
| Supabase | 3 new tables + 1 migration SQL file to seed them |
| Data seeding | Python script to parse Excel files and INSERT rows |
| `lib/vm-analytics/types.ts` | New `YoyRow` interface |
| `lib/vm-analytics/queries.ts` | New `getYoy()` query function |
| `app/(vm-analytics)/vm-analytics/executive/page.tsx` | Fetch YoY, compute deltas, pass to KpiCard |
| `components/vm-analytics/KpiCard.tsx` | Optional `yoy` prop alongside existing `delta` (WoW) |

---

## Step 1 — Supabase: Create the three YoY tables

Create migration file `supabase/migrations/010_yoy_weekly_data.sql` with the following content.

```sql
-- ============================================================
-- YoY historical weekly sales tables
-- Populated from the three uploaded Excel files.
-- week_commencing is the Monday ISO date (YYYY-MM-DD).
-- ============================================================

-- Both stores combined
CREATE TABLE IF NOT EXISTS vm_yoy_both_stores (
  week_commencing   DATE        PRIMARY KEY,
  click_collect     NUMERIC,
  kiosk             NUMERIC,
  till_eat_in       NUMERIC,
  till_takeaway     NUMERIC,
  own_delivery      NUMERIC,
  deliveroo         NUMERIC,
  just_eat          NUMERIC,
  uber_eats         NUMERIC,
  total_sales       NUMERIC,
  in_store_sales    NUMERIC,
  delivery_sales    NUMERIC,
  in_store_pct      NUMERIC,
  delivery_pct      NUMERIC,
  own_delivery_sales NUMERIC,
  aggregate_sales   NUMERIC,
  own_delivery_pct  NUMERIC,
  aggregate_pct     NUMERIC
);

-- Hitchin store only
CREATE TABLE IF NOT EXISTS vm_yoy_hitchin (
  week_commencing   DATE        PRIMARY KEY,
  click_collect     NUMERIC,
  kiosk             NUMERIC,
  till_eat_in       NUMERIC,
  till_takeaway     NUMERIC,
  own_delivery      NUMERIC,
  deliveroo         NUMERIC,
  just_eat          NUMERIC,
  uber_eats         NUMERIC,
  total_sales       NUMERIC,
  in_store_sales    NUMERIC,
  delivery_sales    NUMERIC,
  in_store_pct      NUMERIC,
  delivery_pct      NUMERIC,
  own_delivery_sales NUMERIC,
  aggregate_sales   NUMERIC,
  own_delivery_pct  NUMERIC,
  aggregate_pct     NUMERIC
);

-- Stevenage store only
CREATE TABLE IF NOT EXISTS vm_yoy_stevenage (
  week_commencing   DATE        PRIMARY KEY,
  click_collect     NUMERIC,
  kiosk             NUMERIC,
  till_eat_in       NUMERIC,
  till_takeaway     NUMERIC,
  own_delivery      NUMERIC,
  deliveroo         NUMERIC,
  just_eat          NUMERIC,
  uber_eats         NUMERIC,
  total_sales       NUMERIC,
  in_store_sales    NUMERIC,
  delivery_sales    NUMERIC,
  in_store_pct      NUMERIC,
  delivery_pct      NUMERIC,
  own_delivery_sales NUMERIC,
  aggregate_sales   NUMERIC,
  own_delivery_pct  NUMERIC,
  aggregate_pct     NUMERIC
);

-- Grant read access to the vm-analytics role
GRANT SELECT ON vm_yoy_both_stores TO authenticated;
GRANT SELECT ON vm_yoy_hitchin      TO authenticated;
GRANT SELECT ON vm_yoy_stevenage    TO authenticated;
```

**Run this migration in Supabase SQL Editor** (or via `supabase db push` if the CLI is configured).

---

## Step 2 — Seed the tables from the Excel files

Create `scripts/seed_yoy_data.py`. This script reads the three Excel files and upserts every row into the correct Supabase table via the REST API.

### Prerequisites

```bash
pip install openpyxl requests python-dotenv
```

### Script: `scripts/seed_yoy_data.py`

```python
"""
Seed YoY weekly data from Excel files into Supabase tables.

Usage:
  cd C:/NextJs/peckers-cashflow
  python scripts/seed_yoy_data.py
  
Requires .env.local with:
  NEXT_PUBLIC_VM_SUPABASE_URL=https://jrmvvlkcwjaqruoyevyg.supabase.co
  VM_SUPABSE_SERVICE_ROL_KEY=eyJ...   ← already in .env.local (note the typo in the key name — script matches it exactly)
"""

import os, json
from pathlib import Path
import openpyxl
import requests
from dotenv import dotenv_values

# ── Config ──────────────────────────────────────────────────────────────
env = dotenv_values(".env.local")
# VM Analytics Supabase (separate project: jrmvvlkcwjaqruoyevyg.supabase.co)
VM_SUPABASE_URL = env.get("NEXT_PUBLIC_VM_SUPABASE_URL", "").rstrip("/")
# Service role key — add this to .env.local as VM_SUPABASE_SERVICE_ROLE_KEY
# Get it from: Supabase Dashboard → Project Settings → API → service_role secret
VM_SERVICE_KEY  = env.get("VM_SUPABSE_SERVICE_ROLE_KEY", "")  # note: typo in .env.local key name — matches exactly

EXCEL_FILES = {
    "vm_yoy_both_stores": "yearly_data_both_stores_transformed.xlsx",
    "vm_yoy_hitchin":     "yearly_data_hitchin_transformed.xlsx",
    "vm_yoy_stevenage":   "yearly_data_stevenage_transformed.xlsx",
}

COLUMNS = [
    "week_commencing","click_collect","kiosk","till_eat_in","till_takeaway",
    "own_delivery","deliveroo","just_eat","uber_eats","total_sales",
    "in_store_sales","delivery_sales","in_store_pct","delivery_pct",
    "own_delivery_sales","aggregate_sales","own_delivery_pct","aggregate_pct",
]

def load_excel(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path)
    ws = wb.active
    headers = [cell.value for cell in ws[1]]
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        record = {}
        for h, v in zip(headers, row):
            if h == "week_commencing":
                # Ensure ISO string YYYY-MM-DD
                record[h] = str(v)[:10] if v else None
            else:
                record[h] = float(v) if v is not None else None
        if record.get("week_commencing"):
            rows.append(record)
    return rows

def upsert(table: str, rows: list[dict]):
    url = f"{VM_SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": VM_SERVICE_KEY,
        "Authorization": f"Bearer {VM_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    # Upsert in batches of 500
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        r = requests.post(url, headers=headers, data=json.dumps(batch))
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Upsert failed for {table}: {r.status_code} {r.text}")
        print(f"  {table}: upserted rows {i+1}–{min(i+batch_size, len(rows))}")

if __name__ == "__main__":
    # Excel files should be in the project root or scripts/ folder.
    # Adjust this path if stored elsewhere.
    excel_dir = Path(__file__).parent.parent  # project root

    for table, filename in EXCEL_FILES.items():
        path = excel_dir / filename
        if not path.exists():
            print(f"⚠  Not found: {path} — skipping {table}")
            continue
        rows = load_excel(path)
        print(f"Seeding {table} — {len(rows)} rows from {filename}")
        upsert(table, rows)
        print(f"  ✓ Done")

    print("\nAll tables seeded.")
```

**Important:** Check which Supabase project holds the VM Analytics tables — it may be a *separate* project from the cashflow Supabase. Look at `lib/vm-analytics/client.ts` to confirm the env vars used. Update `VM_SUPABASE_URL` and `VM_SERVICE_KEY` in the script accordingly.

Place the three Excel files in the project root (`C:/NextJs/peckers-cashflow/`) before running.

---

## Step 3 — Add `YoyRow` type

In `lib/vm-analytics/types.ts`, append:

```typescript
// Historical weekly row from one of the vm_yoy_* tables.
// week_commencing is the Monday ISO date (YYYY-MM-DD) one year prior.
export interface YoyRow {
  week_commencing:    string;
  click_collect:      Num;
  kiosk:              Num;
  till_eat_in:        Num;
  till_takeaway:      Num;
  own_delivery:       Num;
  deliveroo:          Num;
  just_eat:           Num;
  uber_eats:          Num;
  total_sales:        Num;
  in_store_sales:     Num;
  delivery_sales:     Num;
  in_store_pct:       Num;
  delivery_pct:       Num;
  own_delivery_sales: Num;
  aggregate_sales:    Num;
  own_delivery_pct:   Num;
  aggregate_pct:      Num;
}
```

---

## Step 4 — Add `getYoy()` to queries.ts

### YoY week logic

For any `weekIso` (e.g. `2026-06-08`), the YoY baseline is the **same ordinal week one year earlier**. Subtracting **364 days (52 × 7)** always lands on the same weekday (Monday) in the prior year, which is the standard QSR convention.

```
2026-06-08  →  364 days back  →  2025-06-09
```

In `lib/vm-analytics/queries.ts`, add:

```typescript
import type { YoyRow } from "@/lib/vm-analytics/types";

/**
 * Returns the Monday ISO date 364 days before `weekIso`.
 * This is the YoY baseline week (same weekday, ~same position in the year).
 */
export function yoyWeekIso(weekIso: string): string {
  const d = new Date(weekIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 364);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch the single YoY row for `weekIso` from the appropriate table.
 *
 * @param weekIso  - the *current* week's Monday (e.g. "2026-06-08")
 * @param store    - null → both stores combined; "Peckers Hitchin" | "Peckers Stevenage"
 * @returns        the matching historical row, or null if no data found
 */
export async function getYoy(
  weekIso: string,
  store: string | null
): Promise<YoyRow | null> {
  const sb = getVMSupabaseServer();

  const table =
    store === "Peckers Hitchin"
      ? "vm_yoy_hitchin"
      : store === "Peckers Stevenage"
      ? "vm_yoy_stevenage"
      : "vm_yoy_both_stores";

  const yoyWeek = yoyWeekIso(weekIso);

  const { data, error } = await sb
    .from(table)
    .select("*")
    .eq("week_commencing", yoyWeek)
    .maybeSingle();

  if (error) {
    console.warn(`getYoy (${table}): ${error.message}`);
    return null;
  }
  return data as YoyRow | null;
}
```

---

## Step 5 — Update the Executive Dashboard page

### 5a. Fetch YoY data

In `app/(vm-analytics)/vm-analytics/executive/page.tsx`, add the `getYoy` import:

```typescript
import { getExec, getExecChannels, getWeeks, getYoy } from "@/lib/vm-analytics/queries";
import type { YoyRow } from "@/lib/vm-analytics/types";
```

Inside the `try` block, add `getYoy` to the parallel fetch **after** `weekIso` is resolved:

```typescript
// Existing:
[rows, chanRows, prevRows, prevChanRows] = await Promise.all([
  getExec(weekIso),
  getExecChannels(weekIso),
  prevIso ? getExec(prevIso) : Promise.resolve<ExecRow[]>([]),
  prevIso ? getExecChannels(prevIso) : Promise.resolve<ExecChannelRow[]>([]),
]);

// Add after the destructuring:
const yoyRow: YoyRow | null = await getYoy(weekIso, activeStore);
```

Or merge into the `Promise.all` as a 5th element:

```typescript
let yoyRow: YoyRow | null = null;
[rows, chanRows, prevRows, prevChanRows, yoyRow] = await Promise.all([
  getExec(weekIso),
  getExecChannels(weekIso),
  prevIso ? getExec(prevIso) : Promise.resolve<ExecRow[]>([]),
  prevIso ? getExecChannels(prevIso) : Promise.resolve<ExecChannelRow[]>([]),
  getYoy(weekIso, activeStore),
] as const);
```

### 5b. Compute YoY deltas

Add after the WoW delta block (the `const netWow = ...` lines):

```typescript
// ---- YoY deltas (from historical Excel data) ----------------------------
const hasYoy = yoyRow !== null;
import { n } from "@/lib/vm-analytics/format";

const yoyTotalSales     = yoyRow ? n(yoyRow.total_sales)        : 0;
const yoyDeliverySales  = yoyRow ? n(yoyRow.delivery_sales)      : 0;
const yoyInStoreSales   = yoyRow ? n(yoyRow.in_store_sales)      : 0;
const yoyOwnDelivery    = yoyRow ? n(yoyRow.own_delivery_sales)  : 0;
const yoyAggregate      = yoyRow ? n(yoyRow.aggregate_sales)     : 0;

const netYoy    = hasYoy && yoyTotalSales    > 0 ? share(combined.netSales            - yoyTotalSales,    yoyTotalSales)    : null;
const delYoy    = hasYoy && yoyDeliverySales > 0 ? share(combined.delivery.netSales   - yoyDeliverySales, yoyDeliverySales) : null;
const inStYoy   = hasYoy && yoyInStoreSales  > 0 ? share(combined.inStore.netSales    - yoyInStoreSales,  yoyInStoreSales)  : null;
const ownDelYoy = hasYoy && yoyOwnDelivery   > 0 ? share(ownDel.netSales              - yoyOwnDelivery,   yoyOwnDelivery)   : null;
const aggYoy    = hasYoy && yoyAggregate     > 0 ? share(aggDel.netSales              - yoyAggregate,     yoyAggregate)     : null;
```

> **Note:** `n()` is already imported from `@/lib/vm-analytics/format` at the top of the file. Remove the duplicate import line above if it causes a lint error.

### 5c. Add YoY KpiCards to the KpiGrid

In the existing `<KpiGrid>` block, add YoY cards **below** the WoW card (or add a `yoy` prop to the existing KpiCards — see Step 6 for the two-delta approach).

**Option A — Separate YoY KpiCards (simplest, no component changes):**

After the existing `<KpiCard label="Net Sales WoW" .../>`, add:

```tsx
{hasYoy && (
  <>
    <KpiCard
      label="Net Sales YoY"
      value={signedPct(netYoy)}
      hint="vs same week last year"
    />
    <KpiCard
      label="Delivery Sales YoY"
      value={signedPct(delYoy)}
      hint="vs same week last year"
    />
    <KpiCard
      label="In-store Sales YoY"
      value={signedPct(inStYoy)}
      hint="vs same week last year"
      tone="good"
    />
    <KpiCard
      label="Own Delivery YoY"
      value={signedPct(ownDelYoy)}
      hint="vs same week last year"
      tone="good"
    />
    <KpiCard
      label="Aggregator YoY"
      value={signedPct(aggYoy)}
      hint="vs same week last year"
      tone="bad"
    />
  </>
)}
```

**Option B — Two deltas per KpiCard (richer, requires KpiCard update — see Step 6):**

Modify the existing cards to accept both `delta` (WoW) and `yoy`:

```tsx
<KpiCard label="Net Sales"             value={gbp(combined.netSales)}          delta={netWow}    yoy={netYoy} />
<KpiCard label="Net Sales — Delivery"  value={gbp(combined.delivery.netSales)} delta={netDelWow} yoy={delYoy} />
<KpiCard label="Net Sales — Own Delivery" value={gbp(ownDel.netSales)}         delta={netOwnWow} yoy={ownDelYoy} tone="good" />
<KpiCard label="Net Sales — Aggregator"   value={gbp(aggDel.netSales)}         delta={netAggWow} yoy={aggYoy}    tone="bad" />
<KpiCard label="Net Sales — In-store"     value={gbp(combined.inStore.netSales)} delta={netInWow} yoy={inStYoy} tone="good" />
```

Start with **Option A** (quickest to ship), then upgrade to Option B if preferred.

---

## Step 6 — Update `KpiCard` component (Option B only)

In `components/vm-analytics/KpiCard.tsx`, add an optional `yoy` prop:

```typescript
// In the KpiCard props interface / type:
yoy?: number | null;   // YoY % delta (positive = growth)
```

In the render, below wherever `delta` is rendered (the WoW badge), add:

```tsx
{typeof yoy === "number" && (
  <span
    className={[
      "text-xs font-medium px-1.5 py-0.5 rounded",
      yoy >= 0
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    ].join(" ")}
    title="Year-on-Year vs same week last year"
  >
    {yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}% YoY
  </span>
)}
```

Use a distinct colour (blue/orange) so WoW and YoY badges are visually distinguishable at a glance.

---

## Step 7 — Add a YoY row to the KPI Summary table

In the `summaryColumns` definition in the executive page, add a YoY column after "Previous Week":

```typescript
{
  key: "yoy",
  header: `YoY (${yoyWeek})`,   // import yoyWeekIso from queries; compute at top of component
  align: "right" as const,
  render: (r: KpiRowDef) => (
    <span className="text-blue-600 dark:text-blue-400 text-sm">
      {/* Only total_sales, delivery_sales, in_store_sales, own_delivery_sales,
          aggregate_sales are available from the Excel — map by kpi label */}
      {getYoyCellValue(r.kpi, yoyRow)}
    </span>
  ),
},
```

Add a helper function `getYoyCellValue` above the `summaryColumns` definition:

```typescript
function getYoyCellValue(kpiLabel: string, yoy: YoyRow | null): string {
  if (!yoy) return "—";
  const { n, gbp } = { n: require("@/lib/vm-analytics/format").n, gbp: require("@/lib/vm-analytics/format").gbp };
  switch (kpiLabel) {
    case "Net Sales":                  return gbp(n(yoy.total_sales));
    case "Net Sales — Delivery":       return gbp(n(yoy.delivery_sales));
    case "Net Sales — Own Delivery":   return gbp(n(yoy.own_delivery_sales));
    case "Net Sales — Aggregator":     return gbp(n(yoy.aggregate_sales));
    case "Net Sales — In-store":       return gbp(n(yoy.in_store_sales));
    default:                           return "—";
  }
}
```

> The Excel does not contain order counts, customer counts, or AOV — those cells will show "—".

**Import `yoyWeekIso` at the top of the page:**

```typescript
import { getExec, getExecChannels, getWeeks, getYoy, yoyWeekIso } from "@/lib/vm-analytics/queries";
```

And compute at the top of the component (inside `try`):

```typescript
const yoyWeek = yoyWeekIso(weekIso);
```

---

## Execution Checklist (for Claude Code / VS Code)

Work through these in order. Each step is independent of the next once the DB and seed are done.

- [ ] **1. Create migration** — Create `supabase/migrations/010_yoy_weekly_data.sql` with the SQL from Step 1 above.
- [ ] **2. Run migration** — Open the Supabase SQL Editor for the VM Analytics project and paste / run the migration SQL. Confirm the three tables appear in the Table Editor.
- [ ] **3. Place Excel files** — Copy the three `.xlsx` files to the project root (`C:/NextJs/peckers-cashflow/`).
- [ ] **4. Create seed script** — Create `scripts/seed_yoy_data.py` with the code from Step 2.
- [ ] **5. Check env vars** — Open `lib/vm-analytics/client.ts` and note the exact env-var names for the VM Supabase URL and key. Update the seed script if they differ from the defaults above.
- [ ] **6. Run seed** — `python scripts/seed_yoy_data.py` from the project root. Verify rows in Supabase Table Editor (`vm_yoy_both_stores` should have ~100+ rows starting 2024-04-29).
- [ ] **7. Add `YoyRow` type** — Append the interface to `lib/vm-analytics/types.ts`.
- [ ] **8. Add `getYoy` + `yoyWeekIso`** — Add both exports to `lib/vm-analytics/queries.ts`.
- [ ] **9. Update executive page** — Import `getYoy` + `yoyWeekIso`, add to parallel fetch, compute YoY deltas, render YoY KpiCards (Option A), add YoY column to summary table.
- [ ] **10. Update `KpiCard`** — (Option B only) Add `yoy` prop and render the second badge.
- [ ] **11. Local test** — `npm run dev`, open `/vm-analytics/executive`, select a recent week, confirm YoY cards appear. Try store-filter (Hitchin / Stevenage) to verify the correct table is queried.
- [ ] **12. Edge cases** — Select a week before 2025-04-29 (the first row in the Excel): YoY should show "—" gracefully (no crash). The `getYoy` returns `null` → `hasYoy = false` → all YoY cells display "—".

---

## Key File Reference

| File | Role |
|------|------|
| `lib/vm-analytics/client.ts` | Supabase client — check env var names here |
| `lib/vm-analytics/queries.ts` | Add `getYoy()` and `yoyWeekIso()` |
| `lib/vm-analytics/types.ts` | Add `YoyRow` interface |
| `app/(vm-analytics)/vm-analytics/executive/page.tsx` | Main dashboard — fetch + render YoY |
| `components/vm-analytics/KpiCard.tsx` | Add `yoy` prop (Option B) |
| `supabase/migrations/010_yoy_weekly_data.sql` | Create the three tables |
| `scripts/seed_yoy_data.py` | Seed the tables from Excel |

---

## Column Mapping: Excel → Dashboard

| Excel column | Dashboard concept |
|-------------|-----------------|
| `total_sales` | Net Sales (total) |
| `delivery_sales` | Net Sales — Delivery |
| `in_store_sales` | Net Sales — In-store |
| `own_delivery_sales` | Net Sales — Own Delivery |
| `aggregate_sales` | Net Sales — Aggregator (Deliveroo + Uber + Just Eat) |
| `deliveroo` | Deliveroo net sales |
| `just_eat` | Just Eat net sales |
| `uber_eats` | Uber Eats net sales |
| `click_collect` | Click & Collect net sales |
| `kiosk` | Kiosk net sales |
| `till_eat_in` | Till (eat-in) net sales |
| `till_takeaway` | Till (takeaway) net sales |
| `in_store_pct` | In-store % |
| `delivery_pct` | Delivery % |
| `own_delivery_pct` | Own Delivery % |
| `aggregate_pct` | Aggregator % |

> **No orders, AOV, or customer counts** are in the Excel data. YoY deltas for those KPIs will show "—".

---

## YoY Week Calculation

```
Current week (selected):   2026-06-08  (Mon 8 Jun 2026 — 2nd week of June 2026)
Subtract 364 days:         2025-06-09  (Mon 9 Jun 2025 — 2nd week of June 2025) ✓
```

364 days = exactly 52 weeks, so the YoY baseline always falls on a **Monday** in the prior calendar year at the same approximate position. This is the standard approach used across Quick Service Restaurant analytics.
