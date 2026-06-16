# Daypart Analysis Dashboard — Calculation Reference

How every field on the **Daypart Analysis** dashboard (`/vm-analytics/executive` → *Daypart Analysis*) is calculated, and which Supabase tables/views feed it. Use this to cross-check numbers against Vita Mojo.

All figures are for the **selected week** (the Week picker) and the **selected store** (the Store picker). When the Store picker is **All Stores**, the page combines both stores; when a single store is picked, every figure below is filtered to that store only.

> **Stores key:** `Peckers Hitchin`, `Peckers Stevenage` (the `store` column in every table).

---

## 0. Store & Week scope

| Control | Source | Notes |
|---|---|---|
| Week picker | `vm_v_available_weeks` | Lists the Mon–Sun weeks that have data. `week_start` (Monday) is the key used in every query. |
| Store picker | `?store=` query param | `All Stores` = both; `Hitchin` / `Stevenage` filter rows by `store` in the page before any aggregation. |

---

## 1. Performance by Time Period (table) + Revenue by Daypart (chart)

**Source view:** `vm_v_daypart_summary` (built from the raw `vm_hourly_order_activity` report).

Columns read: `store, daypart, daypart_rank, orders, revenue`.

The page groups rows by `daypart` across the in-scope store(s) and sums:

| Field | Formula |
|---|---|
| **Orders** | `SUM(orders)` for that daypart across the scoped store(s) |
| **Revenue** | `SUM(revenue)` for that daypart |
| **AOV** | `Revenue ÷ Orders` (recomputed after summing — not an average of per-store AOVs) |

Rows are ordered by `daypart_rank` (Breakfast → Late Night). The **Revenue by Daypart** bar chart plots the same `Revenue` per daypart.

> Note: daypart `orders`/`revenue` in this view are **average daily** activity rolled up per period (from the hourly-activity report), so they describe a typical day's trading shape rather than the raw weekly order count used on the Executive dashboard.

---

## 2. Revenue by Weekday (chart)

**Source view:** `vm_v_daypart_weekday` (from the raw `vm_weekday_order_activity` report).

Columns read: `store, weekday, weekday_id, revenue`.

- One line per in-scope store (so All Stores shows two lines, a single store shows one).
- For each weekday, the plotted value is `SUM(revenue)` for that `(store, weekday)`.
- Days are ordered Monday → Sunday (`weekday_id`).

---

## 3. Lunch Time Deals

This section has two data sources depending on the field:

| Source | What it provides | Used for |
|---|---|---|
| **`vm_meal_deals_sold`** (raw report "Meal Deals Sold (weekly)") | per store, per deal: `no_of_meal_deals`, `net_sales` | Headline KPIs, by-store table, per-deal table & "Top meal deals" chart |
| **`vm_v_lunch_deals_channel`** (view over `vm_detailed_sales_info`) | per store: delivery vs in-store `deal_baskets`, `net_sales`, `aov` | "Delivery vs in-store" table + AOV-Delivery / AOV-In-store cards |
| **`vm_v_lunch_deals_channel_detail`** (view over `vm_detailed_sales_info`) | per store, per individual channel: `deal_baskets`, `net_sales`, `aov` | The two **Channel mix** pie charts |

Why two sources? The "Meal Deals Sold" report has **no channel column**, so the delivery/in-store and per-channel splits are derived from the line-item table `vm_detailed_sales_info`. The two sources reconcile to the penny (verified: delivery + in-store baskets and revenue equal the report totals exactly).

### 3a. Headline KPI cards

From `vm_meal_deals_sold`, summed across the scoped store(s):

| Card | Formula | Table |
|---|---|---|
| **Meal Deals Sold** | `SUM(no_of_meal_deals)` | `vm_meal_deals_sold` |
| **Meal Deal Revenue** | `SUM(net_sales)` | `vm_meal_deals_sold` |
| **Meal Deal AOV** | `Revenue ÷ Meal Deals Sold` | `vm_meal_deals_sold` |
| **AOV — Delivery** | `delivery net_sales ÷ delivery deal_baskets` | `vm_v_lunch_deals_channel` |
| **AOV — In-store** | `in-store net_sales ÷ in-store deal_baskets` | `vm_v_lunch_deals_channel` |

### 3b. "By store" table (shown in All-Stores view)

One row per store, from `vm_meal_deals_sold`:
`Meal Deals Sold = SUM(no_of_meal_deals)`, `Revenue = SUM(net_sales)`, `AOV = Revenue ÷ Sold`.

### 3c. "Delivery vs in-store" table

From `vm_v_lunch_deals_channel`, one row per `(store, channel)`:

| Field | Formula |
|---|---|
| **Orders** | `deal_baskets` = `COUNT(DISTINCT meal_deal_basket_uuid)` for that channel |
| **Revenue** | `net_sales` = `SUM(net_sales)` of that channel's order lines |
| **AOV** | `Revenue ÷ Orders` |

**Delivery vs in-store rule** (in `vm_v_lunch_deals_channel`): a meal-deal order is **delivery** when `create_source = 'delivery'` (own delivery + Deliveroo + Uber Eats + Just Eat), otherwise **in-store** (kiosk / pos / online). This matches the Executive dashboard's delivery definition.

### 3d. Channel mix pie charts — *(the "Kiosk 27%" question)*

**Source view:** `vm_v_lunch_deals_channel_detail`. One pie per in-scope store.

Each slice is an **individual channel**, and its percentage is **share of that store's meal-deal ORDERS (deal baskets) — not revenue**:

```
channel %  =  channel deal_baskets  ÷  store total deal_baskets  × 100
```

**Worked example — Hitchin, week 8–14 Jun 2026** (total = 368 deal baskets):

| Channel | deal_baskets | % shown ( = baskets ÷ 368 ) |
|---|---|---|
| Kiosk | 101 | **27%** |
| Own Delivery | 62 | 17% |
| Just Eat | 51 | 14% |
| Till (takeaway) | 51 | 14% |
| Uber Eats | 44 | 12% |
| Click & Collect | 43 | 12% |
| Deliveroo | 11 | 3% |
| Till (eat-in) | 5 | 1% |

So **Kiosk 27% = 101 ÷ 368**, using the **count of meal-deal orders**, not revenue. (Hovering a slice shows the order count; the % is in the slice label.)

**How each channel name is assigned** (in `vm_v_lunch_deals_channel_detail`, from `vm_detailed_sales_info`):

| Channel | Rule |
|---|---|
| Deliveroo | `create_source = 'delivery'` **and** `payment_method` contains `deliveroo` |
| Uber Eats | `create_source = 'delivery'` **and** `payment_method` contains `uber` |
| Just Eat | `create_source = 'delivery'` **and** `payment_method` contains `just eat` |
| Own Delivery | `create_source = 'delivery'` **and** payment is none of the above (card/cash) |
| Click & Collect | `create_source = 'online'` |
| Kiosk | `create_source = 'kiosk'` |
| Till (eat-in) | `create_source = 'pos'` **and** `eat_in_takeaway = 'Eat-in'` |
| Till (takeaway) | everything else (`create_source = 'pos'`, takeaway) |

> One meal-deal order = one distinct `meal_deal_basket_uuid`. Revenue is the sum of `net_sales` across that basket's lines. `create_source` is authoritative for the delivery/in-store group, so these per-channel numbers add up exactly to the delivery/in-store table in 3c.

### 3e. "Meal deals by revenue" table + "Top meal deals by revenue" chart

From `vm_meal_deals_sold`, grouped by `meal_deal_name` across the scoped store(s):

| Field | Formula |
|---|---|
| **Sold** | `SUM(no_of_meal_deals)` for that deal |
| **Revenue** | `SUM(net_sales)` for that deal |
| **AOV** | `Revenue ÷ Sold` |

The table is sorted by Revenue (highest first); the chart shows the **top 8** deals by Revenue.

---

## Cross-check queries (run in the VM Supabase SQL editor)

```sql
-- Daypart table / chart
select daypart, sum(orders) orders, sum(revenue) revenue
from vm_v_daypart_summary
where week_start = '2026-06-08' and store = 'Peckers Hitchin'
group by daypart order by min(daypart_rank);

-- Lunch deal headline KPIs
select store, sum(vm_num(no_of_meal_deals)) sold, sum(vm_num(net_sales)) revenue
from vm_meal_deals_sold
where week_start = '2026-06-08'
group by store;

-- Delivery vs in-store
select * from vm_v_lunch_deals_channel where week_start = '2026-06-08' order by store, channel;

-- Channel mix pie (orders share)
select store, channel_name, deal_baskets,
       round(100.0 * deal_baskets / sum(deal_baskets) over (partition by store), 0) as pct
from vm_v_lunch_deals_channel_detail
where week_start = '2026-06-08'
order by store, deal_baskets desc;
```

---

## Source-of-truth summary

| Dashboard element | Table / View | Underlying raw report |
|---|---|---|
| Performance by Time Period, Revenue by Daypart | `vm_v_daypart_summary` | Average order activity per hour per weekday |
| Revenue by Weekday | `vm_v_daypart_weekday` | Average order activity per weekday |
| Lunch deal KPIs / by-store / per-deal / top chart | `vm_meal_deals_sold` | Meal Deals Sold (table) (weekly) |
| Delivery vs in-store, AOV-Delivery/In-store | `vm_v_lunch_deals_channel` | Detailed Sales Info |
| Channel mix pies | `vm_v_lunch_deals_channel_detail` | Detailed Sales Info |

_Last updated: 2026-06-16._
