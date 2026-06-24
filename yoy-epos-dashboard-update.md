# YoY EPOS Data — Executive Dashboard Update

## Overview

The `vm_yoy_hitchin`, `vm_yoy_stevenage`, and `vm_yoy_both_stores` Supabase tables
already hold net-sales YoY data. This task populates the missing order/customer columns
(from EPOS Excel exports) and updates the Executive Dashboard so every row in the KPI
Summary table shows a YoY value instead of `—`.

---

## Step 1 — Run SQL in Supabase (manual)

File: `supabase_yoy_epos.sql` (already in the project root)

Open the **vm-analytics** Supabase project → SQL Editor → paste & run the entire file.

What the SQL does:
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — safely adds these columns to all three tables:
  `click_collect`, `kiosk`, `till_eat_in`, `till_takeaway`, `own_delivery`,
  `deliveroo`, `just_eat`, `uber_eats`, `total_orders`, `new_customers`,
  `return_customers`, `total_customers`
- 108 `INSERT … ON CONFLICT DO UPDATE` blocks per table — upserts EPOS order counts
  and customer metrics for every week from 2024-04-29 onwards without touching
  the existing net-sales columns.

---

## Step 2 — Code changes (Claude Code implements these)

### 2a. `lib/vm-analytics/types.ts` — extend `YoyRow`

Add four new fields to the `YoyRow` interface (after `aggregate_pct`):

```ts
// From EPOS channel exports
total_orders:      Num;
new_customers:     Num;
return_customers:  Num;
total_customers:   Num;
```

The channel order-count columns (`click_collect`, `kiosk`, `till_eat_in`,
`till_takeaway`, `own_delivery`, `deliveroo`, `just_eat`, `uber_eats`) are already
declared in `YoyRow` — no change needed there.

---

### 2b. `app/(vm-analytics)/vm-analytics/executive/page.tsx`

#### 2b-i. Compute YoY order/customer deltas for the top KPI cards

Add these lines immediately after the existing `aggYoy` calculation (around line 100):

```ts
// YoY deltas for orders and customers (from EPOS data)
const yoyTotalOrders    = yoyRow ? n(yoyRow.total_orders)    : 0;
const yoyTotalCustomers = yoyRow ? n(yoyRow.total_customers)  : 0;

const ordYoy  = hasYoy && yoyTotalOrders    > 0 ? share(combined.orders     - yoyTotalOrders,    yoyTotalOrders)    : null;
const custYoy = hasYoy && yoyTotalCustomers > 0 ? share(combined.customers  - yoyTotalCustomers, yoyTotalCustomers) : null;
```

#### 2b-ii. Pass the new yoy deltas to the KPI cards

Find the two KpiCard elements that currently have no `yoy` prop and add it:

```tsx
// Before:
<KpiCard label="Total Orders" value={int(combined.orders)} delta={ordWow} />
<KpiCard label="Customers"    value={int(combined.customers)} delta={custWow} />

// After:
<KpiCard label="Total Orders" value={int(combined.orders)} delta={ordWow} yoy={ordYoy} />
<KpiCard label="Customers"    value={int(combined.customers)} delta={custWow} yoy={custYoy} />
```

#### 2b-iii. Replace `getYoyCellValue` entirely

Replace the existing `getYoyCellValue` function with this version that fills in all
rows in the KPI Summary table:

```ts
const getYoyCellValue = (kpiLabel: string, yoy: YoyRow | null): string => {
  if (!yoy) return "—";

  // Derived channel groups from the new EPOS order-count columns
  const yoyOwnDel  = n(yoy.own_delivery);
  const yoyDel     = n(yoy.deliveroo) + n(yoy.just_eat) + n(yoy.uber_eats);
  const yoyDelAll  = yoyOwnDel + yoyDel;                // total delivery orders
  const yoyIns     = n(yoy.click_collect) + n(yoy.kiosk) + n(yoy.till_eat_in) + n(yoy.till_takeaway);
  const yoyTotOrd  = n(yoy.total_orders) || (yoyDelAll + yoyIns);

  switch (kpiLabel) {
    // ── Net Sales (already populated) ──────────────────────────────────────
    case "Net Sales":                return gbp(n(yoy.total_sales));
    case "Net Sales — Delivery":     return gbp(n(yoy.delivery_sales));
    case "Net Sales — Own Delivery": return gbp(n(yoy.own_delivery_sales));
    case "Net Sales — Aggregator":   return gbp(n(yoy.aggregate_sales));
    case "Net Sales — In-store":     return gbp(n(yoy.in_store_sales));

    // ── Orders & Customers (new EPOS columns) ──────────────────────────────
    case "Total Orders": return yoyTotOrd > 0 ? int(yoyTotOrd) : "—";
    case "Customers":    return n(yoy.total_customers) > 0 ? int(n(yoy.total_customers)) : "—";

    // ── AOV (derived from sales ÷ orders) ──────────────────────────────────
    case "AOV (Blended)":
      return yoyTotOrd > 0 && n(yoy.total_sales) > 0
        ? gbp(n(yoy.total_sales) / yoyTotOrd)
        : "—";
    case "AOV — Delivery":
      return yoyDelAll > 0 && n(yoy.delivery_sales) > 0
        ? gbp(n(yoy.delivery_sales) / yoyDelAll)
        : "—";
    case "AOV — Own Delivery":
      return yoyOwnDel > 0 && n(yoy.own_delivery_sales) > 0
        ? gbp(n(yoy.own_delivery_sales) / yoyOwnDel)
        : "—";
    case "AOV — Aggregator":
      return yoyDel > 0 && n(yoy.aggregate_sales) > 0
        ? gbp(n(yoy.aggregate_sales) / yoyDel)
        : "—";
    case "AOV — In-store":
      return yoyIns > 0 && n(yoy.in_store_sales) > 0
        ? gbp(n(yoy.in_store_sales) / yoyIns)
        : "—";

    // ── Delivery channel order counts ──────────────────────────────────────
    case "Delivery Orders":
      return yoyDelAll > 0
        ? `${int(yoyDelAll)} · ${pct(n(yoy.delivery_pct))}`
        : "—";
    case "Own Delivery":
      return yoyOwnDel > 0
        ? `${int(yoyOwnDel)} · ${pct(n(yoy.own_delivery_pct))}`
        : "—";
    case "Deliveroo":
      return n(yoy.deliveroo) > 0 ? int(n(yoy.deliveroo)) : "—";
    case "Uber Eats":
      return n(yoy.uber_eats) > 0 ? int(n(yoy.uber_eats)) : "—";
    case "Just Eat":
      return n(yoy.just_eat) > 0 ? int(n(yoy.just_eat)) : "—";

    // ── In-store channel order counts ──────────────────────────────────────
    case "In-store Orders":
      return yoyIns > 0
        ? `${int(yoyIns)} · ${pct(n(yoy.in_store_pct))}`
        : "—";
    case "Click & Collect":
      return n(yoy.click_collect) > 0 ? int(n(yoy.click_collect)) : "—";
    case "Kiosk":
      return n(yoy.kiosk) > 0 ? int(n(yoy.kiosk)) : "—";
    case "Till (takeaway)":
      return n(yoy.till_takeaway) > 0 ? int(n(yoy.till_takeaway)) : "—";
    case "Till (eat-in)":
      return n(yoy.till_eat_in) > 0 ? int(n(yoy.till_eat_in)) : "—";

    default:
      return "—";
  }
};
```

---

## Notes

- **AOV percentages for individual aggregator channels** (Deliveroo, Uber Eats, Just Eat)
  are not shown because per-channel sales aren't tracked separately in the YoY tables.
  The order count alone is shown for those rows.

- **In-store channel percentages** (Click & Collect, Kiosk, Till rows) similarly show
  order count only, since in-store sub-channel sales aren't split in the YoY tables.

- **`Delivery Orders` and `In-store Orders` percentages** reuse the pre-computed
  `delivery_pct` / `in_store_pct` columns that already exist in the tables and are
  populated (they reflect net-sales share, consistent with the rest of the dashboard).

- **`Own Delivery` percentage** uses `own_delivery_pct` which is also already in the
  tables.

- The `yoyWeekIso` function (364-day offset) is unchanged — the new EPOS data covers
  the same week dates as the existing net-sales rows, so the lookup will match.
