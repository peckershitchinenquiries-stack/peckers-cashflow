# Peckers Cashflow Project — Complete Documentation

**Last Updated:** 2026-06-17  
**Project:** peckers-cashflow (Next.js + Supabase VM Analytics)  
**Stores:** Peckers Hitchin, Peckers Stevenage

---

## 1. Project Overview

A Next.js analytics dashboard system that pulls weekly KPI data from Vita Mojo (POS) via Supabase. The system provides 7 dashboards with store-specific filtering and automated AI commentary.

### Key Dashboards
1. **Executive Dashboard** — headline KPIs, AOV, delivery mix
2. **Product Performance** — top/falling items, category breakdown
3. **Daypart Analysis** — trading patterns by hour/day + Lunch Time Deals
4. **Delivery Platform Performance** — platform mix (Own Delivery, Deliveroo, Uber, JustEat, In-store)
5. **Weekly Exception Report** — AI-generated risks and opportunities
6. **Store Comparison** — Hitchin vs Stevenage
7. **Labor Cost Performance** — labor % of revenue

### Store-Specific Dashboards (4 of 7)
- Executive, Products, Daypart, Delivery → all support `?store=hitchin` / `?store=stevenage`
- Exception, Comparison, Labor → no per-store filtering

---

## 2. Store Filtering Pattern

Query parameter: `?store=hitchin` or `?store=stevenage`  
Resolution: `resolveStore(searchParams.store)` → canonical store name or null  
Data filtering: `if (activeStore) { rows = rows.filter(r => r.store === activeStore) }`  
Display: Subtitle shows scope (e.g., "Stevenage" or "both stores combined")

---

## 3. Dashboard Specifications

### 3.1 Executive Dashboard

**Headline KPIs:** Net Sales, Orders, AOV, Customers, Delivery %, Collection %, Eat-In %  
**NEW:** Net Sales — Delivery, Net Sales — In-store, AOV (Blended)  
**All include WoW % deltas**

**Channel Breakdown:**
- Delivery: Own Delivery, Deliveroo, Uber Eats, Just Eat
- In-store: Click & Collect, Kiosk, Till (eat-in), Till (takeaway)
- Determined by `create_source` + `payment_method` + `eat_in_takeaway` flags

**Data Sources:** `vm_v_exec_dashboard_with_wow`, `vm_net_sales_by_channel`, `vm_orders_by_channel`

---

### 3.2 Product Performance

**Top Products:** Ranked by revenue (top 15), excludes service/delivery fee lines  
**Category Performance:**
- Blank category = products without external_category (typically 70–90% of sales)
- Service Charge = platform/service fee line items
- delivery fee = delivery charge line items

**Data Sources:** `vm_v_product_performance`, `vm_v_category_performance`

---

### 3.3 Daypart Analysis

**Section 1:** Daypart (Breakfast, Lunch, Dinner, Late Night) with Orders, Revenue, AOV  
**Note:** AVERAGE DAILY values (from hourly report), not raw weekly totals

**Section 2:** Revenue by Weekday (line chart, one per store)

**Section 3:** Lunch Time Deals
- Headline KPIs: Meal Deals Sold, Revenue, AOV (from `vm_meal_deals_sold`)
- AOV — Delivery, AOV — In-store (from `vm_v_lunch_deals_channel`)
- By Store table (All Stores view)
- Delivery vs In-store table
- Channel Mix pie charts (All Stores view, one per store)

**Channel Mix Calculation:**
- **Each slice = % of deal-basket orders (NOT revenue)**
- Formula: `channel deal_baskets / store total deal_baskets × 100`
- Channels: Kiosk, Own Delivery, Deliveroo, Uber Eats, Just Eat, Click & Collect, Till (eat-in), Till (takeaway)

**Channel Assignment Rules:**
| Channel | Rule |
|---|---|
| Deliveroo | `create_source = 'delivery'` **AND** `payment_method` contains `deliveroo` |
| Uber Eats | `create_source = 'delivery'` **AND** `payment_method` contains `uber` |
| Just Eat | `create_source = 'delivery'` **AND** `payment_method` contains `just eat` |
| Own Delivery | `create_source = 'delivery'` **AND** card/cash payment |
| Click & Collect | `create_source = 'online'` |
| Kiosk | `create_source = 'kiosk'` |
| Till (eat-in) | `create_source = 'pos'` **AND** `eat_in_takeaway = 'Eat-in'` |
| Till (takeaway) | All other POS |

**Data Sources:** `vm_v_daypart_summary`, `vm_v_daypart_weekday`, `vm_meal_deals_sold`, `vm_v_lunch_deals_channel`, `vm_v_lunch_deals_channel_detail`

---

### 3.4 Delivery Platform Performance

**Channel Breakdown Table:** Channel, Revenue, Share %, Orders, AOV, Revenue WoW %  
**Revenue by Channel:** Bar chart  
**Revenue Share:** Pie chart  
**By Store Section (All Stores view):** Side-by-side store comparison

**Data Sources:** `vm_v_delivery_mix` (reads from `vm_v_delivery_channel`)

**CRITICAL FIX (2026-06-17):**
- Bug: WoW returning literal `0` everywhere
- Cause: View stale in Supabase (old DDL without LAG formula)
- Fix: Re-ran `vm-extractor/sql/kpi_views.sql` sections 4.1–4.2
- Result: WoW now shows real values (+8.2%, -15.8%, +52.6%, etc.)

---

### 3.5 Weekly Exception Report

**AI-Generated Sections:**
1. Falling Attachment Rates
2. Underperforming Products
3. Platform Dependence
4. Labor Cost Risk
5. Upselling Opportunity
6. Fastest Growing Category

**Attachment Rate:** `attachment_pct = (orders_with_item / total_orders) × 100`

**Thresholds:**
```
attachDropPp: 3, attachMinOrdersPct: 15, platformDependencePct: 40,
labourTargetPct: 30, productDeclinePct: -25, productMinUnits: 20
```

---

### 3.6 Store Comparison

**Side-by-side:** Hitchin vs Stevenage  
**No store selector** (always both stores)

---

### 3.7 Labor Cost Performance

**Metrics:** Labour Cost, Revenue, Labour %  
**Data Source:** Cashflow Supabase (separate from VM)  
**Note:** Current in-progress week excluded

---

## 4. Commentary System (Cache)

**Cache Key per store:**
```
"dashboard"                  // All Stores
"dashboard@Peckers Hitchin"  // Hitchin
"dashboard@Peckers Stevenage" // Stevenage
```

**Clear stale commentary:**
```sql
DELETE FROM vm_generated_insights WHERE dashboard LIKE 'delivery%';
```

---

## 5. Week-on-Week (WoW) Formula

```sql
ROUND(100 * (current - LAG(current) OVER w) / NULLIF(LAG(current) OVER w, 0), 1)
WINDOW w AS (PARTITION BY store, [dimension] ORDER BY week_start)
```

First week of partition → NULL | Later weeks → % change

---

## 6. Quick Reference

**Validate TypeScript:**
```bash
npx tsc --noEmit
```

**Query Supabase (Node):**
```javascript
const fs = require("fs");
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["\x27]|["\x27]$/g, "");
}
const url = env.NEXT_PUBLIC_VM_SUPABASE_URL;
const key = env.NEXT_PUBLIC_VM_SUPABASE_ANON_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}` };
(async () => {
  const r = await fetch(`${url}/rest/v1/vm_v_delivery_mix?select=*&limit=10`, { headers: H });
  console.log(await r.json());
})();
```

---

**Document Version:** 1.0  
**Last Sync:** 2026-06-17  
**Status:** All dashboards live, store-filtering implemented, commentary cache per-store
