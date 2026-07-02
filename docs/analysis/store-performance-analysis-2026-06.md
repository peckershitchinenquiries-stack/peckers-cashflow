# Peckers — Store Performance Analysis: Hitchin vs Stevenage
**Prepared:** 30 June 2026 · **Analyst:** Retail Analytics · **Source:** Vita Mojo EPOS (Supabase `vm_*` tables)

---

## 0. Data Coverage & Confidence (read this first)

This report is built **entirely from the real EPOS data in the database** — no figures are estimated or invented except where explicitly labelled "est." (e.g. aggregator commission, which uses an industry-standard rate against real sales).

| Dataset | Granularity | Coverage | Confidence |
|---|---|---|---|
| Weekly sales, channel mix, orders, customers (`vm_yoy_hitchin/stevenage/both`) | Per store, per week | **2024‑04‑29 → 2026‑05‑18 (108 weeks, ~2 yrs)** | **High** for sales £ |
| Live EPOS KPIs (`vm_v_exec_dashboard`) | Per store, per week | 2026‑05‑25 → 2026‑06‑22 (5 weeks) | High |
| Product‑level sales (`vm_v_product_performance`) | Per item, per store, per week | **Only 2026‑05‑25 → 2026‑06‑22 (5 weeks)** | Medium (short window) |
| External category report | Per category | Effectively **blank** (untagged) | Not usable |

**Three limitations the brief asked for but the data cannot support honestly:**

1. **"Top products from 2–3 years ago vs now" is not possible.** Product‑level history is **5 weeks deep**, not years. I deliver a current‑bestseller and 5‑week‑momentum view instead, and flag it as short‑window.
2. **Category‑performance shifts cannot be analysed** — the category field is unpopulated for these stores (only "delivery fee" / "Service Charge" are tagged). Product‑level data is the usable substitute.
3. **Order & customer *counts* in the historical table are noisy** (week‑to‑week swings inconsistent with stable sales £). All trend conclusions are therefore anchored on **net sales £**, which is reliable. Order/customer figures are used only directionally.

There is **no delivery-time / fulfilment-quality data** (driver times, late orders, prep times) in the database, so the "delivery performance correlates with sales" question is answered structurally (channel economics), not operationally.

---

## 1. Executive Summary

**The two stores are on opposite trajectories, and the headline risk is not revenue — it is margin.**

### Hitchin — *flat-to-declining over two years, now recovering*
- Trailing‑52‑week net sales: **£648,429**.
- 2‑year average YoY growth: **−3.0%**. The store ground down through 2024–2025 (quarterly average weekly sales fell from ~£14.4k in 2024‑Q2 to a **£11.6k low in 2026‑Q1**).
- **Turning point ≈ Q2 2026:** last‑8‑weeks YoY is **+4.8%**, and 2026‑Q2 rebounded to **£13.9k/wk**. Recovery is real but young.
- Structural problem: **~41–44% of sales go through aggregators** (Deliveroo/Uber/Just Eat) — the highest-cost channel.

### Stevenage — *strong, sustained growth*
- Trailing‑52‑week net sales: **£904,321** (40% larger than Hitchin).
- 2‑year average YoY growth: **+11.1%**; **last‑8‑weeks YoY +23%**. Quarterly average weekly sales rose from ~£14.5k (late 2024) to **£19.75k in 2026‑Q2**.
- Hidden risk: its **channel mix is deteriorating** even as revenue grows — aggregator share has crept from **21% (2024‑Q2) to ~38–40%**, while own‑delivery share *fell* from 13.9% to ~10.7%. Growth is increasingly being "rented" from aggregators.

### Top 3 revenue/margin risks
1. **Aggregator commission leakage — ~£170k/year combined** (est. £77k Hitchin + £92k Stevenage at a 27% commission assumption). This is the single largest controllable P&L item identified.
2. **Stevenage's worsening channel mix** — top-line growth is masking a structural shift toward the lowest-margin channel; own-delivery is shrinking.
3. **Hitchin's fragile recovery** — only 8 weeks old and starting from a low base; reversible if not actively defended.

### Top 3 opportunities
1. **Channel-mix migration** — shifting even 10 points of aggregator volume to own-delivery/collection recovers tens of £k/year per store at near-zero cost.
2. **Replicate Stevenage's demand engine in Hitchin** — Stevenage proves the catchment/menu can grow 20%+; Hitchin is under-trading relative to it.
3. **Kiosk & own-delivery are the proven high-margin growth channels** — Kiosk is already the #1 in-store channel at both stores and own-delivery is rising in Hitchin.

---

## 2. Store Performance Trends

### 2.1 Quarterly average weekly net sales (real data)

| Quarter | Hitchin | Stevenage | Combined |
|---|---:|---:|---:|
| 2024‑Q2 | £14,384 | £18,648 | £33,031 |
| 2024‑Q3 | £13,016 | £14,991 | £28,008 |
| 2024‑Q4 | £12,035 | £14,539 | £26,574 |
| 2025‑Q1 | £12,647 | £15,592 | £28,239 |
| 2025‑Q2 | £13,587 | £16,408 | £29,995 |
| 2025‑Q3 | £12,519 | £16,594 | £29,113 |
| 2025‑Q4 | £11,822 | £17,144 | £28,966 |
| 2026‑Q1 | £11,578 | £17,385 | £28,963 |
| 2026‑Q2* | £13,934 | £19,752 | £33,686 |

\*2026‑Q2 = 7 weeks to 18 May (historical table); live EPOS confirms the trend continuing into June.

**Reading it:** Stevenage's line climbs almost monotonically (+£5.1k/wk from trough to 2026‑Q2). Hitchin's line *descends* through 2025 to a Q1‑2026 trough, then snaps back in Q2‑2026.

```
Avg weekly net sales by quarter (£k)
        24Q2 24Q3 24Q4 25Q1 25Q2 25Q3 25Q4 26Q1 26Q2
Stev   18.6 15.0 14.5 15.6 16.4 16.6 17.1 17.4 19.8  ▲ steady climb
Hitch  14.4 13.0 12.0 12.6 13.6 12.5 11.8 11.6 13.9  ▼ then ▲ rebound
```

### 2.2 Year-over-year (matched week, −364 days)

| Metric | Hitchin | Stevenage | Combined |
|---|---:|---:|---:|
| Avg YoY, all 56 comparable weeks | **−3.0%** | **+11.1%** | **+4.6%** |
| Avg YoY, most recent 8 weeks | **+4.8%** | **+23.1%** | **+14.8%** |

Stevenage's most recent comparable weeks (real): +19%, +26%, +31%, +21%, +23%, +21%, +22%, +21% — remarkably consistent ~20%+ growth. Hitchin's recent run turned positive: −0.2%, +7.2%, +9.6%, +0.9%, −1.3%, +2.2%, +7.1%, +12.8%.

### 2.3 Seasonality
The single lowest week for **both** stores is **w/c 2024‑12‑30** (Hitchin £8,443; Stevenage £11,213) — the Christmas/New‑Year trough. This is a predictable seasonal dip, **not** structural decline, and should be excluded when judging trend.

### 2.4 Turning points
- **Hitchin:** structural decline mid‑2024 → Q1‑2026; **recovery inflection ~April 2026**.
- **Stevenage:** consistent growth throughout; **acceleration from ~Q4‑2025** (YoY stepped up to the low‑20s%).

---

## 3. Revenue Shrinkage — Root Cause Analysis

Genuine *shrinkage* applies to **Hitchin, 2024‑Q3 → 2026‑Q1** (−£2.8k/wk peak‑to‑trough, roughly −20%). Diagnosis from the data:

| Candidate cause | Evidence in data | Verdict |
|---|---|---|
| **Seasonal vs structural** | Decline persisted across all quarters, not just winter | **Structural**, not seasonal |
| **Channel-mix shift** | Hitchin sat at ~44–46% aggregator through 2024–25 — highest-cost channel; in‑store share stagnant ~40% | **Primary margin driver**; suppresses contribution even when sales hold |
| **Product/demand** | No multi-year product data; 5‑week window shows healthy core (OG Burger, Fries, Tenders) | **Inconclusive** (data gap) |
| **Competitive/market** | Stevenage grew in the *same* period and economy → not a market-wide demand collapse | Hitchin issue is **store-specific**, not macro |
| **Delivery/fulfilment ops** | No fulfilment-quality data available | **Cannot assess** |

**Conclusion (medium-high confidence):** Hitchin's 2024–25 weakness was a **store-specific demand softness compounded by an expensive channel mix**, not a seasonal or market-wide effect. The Q2‑2026 rebound coincides with aggregator share *falling* to 38.3% and own-delivery *rising* to 16.7% — i.e. the recovery is partly a **mix improvement**, which is exactly the right kind.

---

## 4. The Margin Story — Channel Economics (the core finding)

### 4.1 Latest-week net sales by channel (w/c 2026‑06‑22, real)

| Channel | Hitchin | Stevenage |
|---|---:|---:|
| Kiosk (in‑store) | £3,176 (20.5%) | £5,928 (29.8%) |
| Just Eat *(agg)* | £3,280 (21.2%) | £3,862 (19.4%) |
| Own Delivery | £2,642 (17.1%) | £2,677 (13.4%) |
| Uber Eats *(agg)* | £2,307 (14.9%) | £2,104 (10.6%) |
| Till takeaway | £1,876 (12.1%) | £2,145 (10.8%) |
| Deliveroo *(agg)* | £769 (5.0%) | £1,750 (8.8%) |
| Click & Collect | £1,252 (8.1%) | £1,052 (5.3%) |
| Till eat‑in | £179 (1.2%) | £398 (2.0%) |
| **Aggregator total** | **£6,356 (41.1%)** | **£7,717 (38.7%)** |

### 4.2 Estimated commission leakage (real sales × 27% assumed blended commission)

| | Hitchin | Stevenage | Combined |
|---|---:|---:|---:|
| Aggregator sales (trailing 52wk) | £283,762 | £342,579 | £626,341 |
| **Est. annual commission @27%** | **~£77k** | **~£92k** | **~£170k** |

> Confidence: **Medium.** Sales figures are exact; the 27% rate is an industry assumption (typical 25–35% incl. delivery). Even at 25% the combined figure exceeds £155k/year. **This is the highest-leverage number in the report.**

### 4.3 Mix trend (early 13 weeks vs latest 13 weeks)

| Store | In‑store | Own delivery | Aggregator |
|---|---|---|---|
| Hitchin | 41.8% → **44.0%** ▲ | 14.3% → **16.0%** ▲ | 43.9% → **40.0%** ▼ *(improving)* |
| Stevenage | 61.7% → **54.3%** ▼ | 13.3% → **10.7%** ▼ | 25.0% → **35.0%** ▲ *(deteriorating)* |

**Hitchin is fixing its mix; Stevenage is letting its mix slide.** Stevenage's growth is increasingly aggregator-sourced — profitable revenue is being converted into commission expense.

---

## 5. Product Performance (5-week window — short-term signal only)

> ⚠️ Only 5 weeks of product data exist. Treat these as **current momentum**, not multi-year trends. Week-to-week swings on small lines are noise.

### 5.1 Current bestsellers (w/c 2026‑06‑22)

**Both stores share the same core engine:** `The OG Burger` is #1 at both (Hitchin £1,212 / Stevenage £1,657), followed by `Fries`, `The OG Wrap`, and `Southern Fried Buttermilk Tenders`. The menu's "hero" items are consistent and healthy — the OG Burger grew +27% WoW at Hitchin.

| Rank | Hitchin | Stevenage |
|---|---|---|
| 1 | OG Burger £1,212 | OG Burger £1,657 |
| 2 | Fries £984 | OG Wrap £1,137 |
| 3 | OG Wrap £641 | Fries £1,101 |
| 4 | OG Peri‑Peri Rice Bowl £553 | Southern Fried Tenders £1,063 |
| 5 | Southern Fried Tenders £514 | Honey Glazed BBQ Tenders £922 |

### 5.2 Momentum signals (low confidence — 5wk)
- **Rising (Hitchin):** Mini Platter for 1 (+72%), Peckers Health Box (+190%), Mac & Cheese (+59%), Korean Gochujang Tenders (+76%) — a clear **tenders/health/sharing** uptick worth watching.
- **Softening (Stevenage):** Garlic Aioli Tenders (−33% WoW), Honey Glazed BBQ Tenders (−22%), several platter/wings lines down 40‑50% — but on a 5‑week base this is likely **menu rotation / promo noise**, not decline.
- **Milkshakes** (Oreo, Reese's, Kinder Bueno) are rising at both stores — a low-cost, high-margin **attach/upsell** opportunity.

**Action vs data gap:** to do the brief's "products declining >50% over 2–3 years" properly, the warehouse needs **product history backfilled**. Right now it physically isn't there.

---

## 6. Recommendations

### Top 5 actions to protect/grow contribution
1. **Launch a channel-migration push (biggest £ lever, ~£170k/yr at stake).** Drive customers off aggregators onto own-delivery & collection: in-pack flyers with a direct-order discount code, loyalty on direct orders only, and "order direct & save" messaging. **Target: −10pts aggregator share** at each store within 6 months.
2. **Stop Stevenage's mix slide.** It is growing, so protect *quality* of that growth — set an explicit **own-delivery share floor (≥13%)** and treat rising aggregator % as a managed cost, not free growth.
3. **Defend & extend Hitchin's recovery.** The April‑2026 inflection is real but 8 weeks young. Lock in the mix improvement (aggregator 44%→38%) and keep own-delivery climbing; don't let marketing attention drift to the "winning" store only.
4. **Renegotiate aggregator commercials** using the now-quantified volume (£626k/yr combined). Even a 2–3pt rate reduction ≈ £12–19k/yr.
5. **Push high-margin attach** (milkshakes, fries upgrades, sharing platters) at the Kiosk — the #1 in-store channel — where there is no commission and full price control.

### Product strategy
- **Protect the hero line-up** (OG Burger / Wrap, Fries, Buttermilk Tenders) — never out-of-stock, feature first on every channel.
- **Watch the tenders/health/milkshake risers** as candidate promo features.
- **Backfill product history** so real lifecycle analysis becomes possible next quarter.

### Pricing & inventory
- Aggregator menus should carry a **price uplift** to recover commission (standard practice) — verify this is in place; if not, it's an immediate margin recovery.
- No multi-year demand data → keep inventory decisions on the 5‑week trailing signal until history is backfilled.

### Store-specific plans
- **Hitchin:** mix-led recovery — own-delivery + collection growth, aggregator share down. Goal: sustain £13–14k/wk and rebuild toward 2024 levels.
- **Stevenage:** growth-quality — keep top-line momentum but arrest the aggregator drift; convert kiosk strength into attach revenue.

---

## 7. Risk Assessment & Roadmap

| Horizon | Initiative | Expected effect | Confidence |
|---|---|---|---|
| **30 days** | Audit aggregator menu pricing uplift; launch direct-order flyer + code | Immediate margin recovery; mix shift begins | High |
| **30 days** | Backfill product-level history into warehouse | Unlocks real product lifecycle analysis | High |
| **90 days** | Loyalty/direct-order programme live; −5pts aggregator share | ~£15–30k annualised commission saved | Medium |
| **6 months** | −10pts aggregator share both stores; Hitchin sustained recovery | Tens of £k/yr contribution; de-risked growth | Medium |

**Residual risks:** (a) Hitchin recovery reverses if attention concentrates on Stevenage; (b) aggregators tighten terms or push their own promos, deepening dependence; (c) decisions made on the noisy order/customer counts rather than sales £.

---

## Appendix — Methodology & Reproducibility
- **YoY:** matched each week to the week 364 days earlier (52×7 — QSR convention; same weekday), 56 comparable weeks.
- **Quarters:** calendar quarters; "avg weekly sales" = quarter sales ÷ weeks in quarter (controls for partial quarters).
- **Net sales** = `total_sales` from `vm_yoy_*` (matches the Executive dashboard's net-sales basis) and `net_sales` from `vm_v_exec_dashboard`.
- **Aggregator** = Deliveroo + Uber Eats + Just Eat. **Own delivery** and **in-store** (Kiosk, Click & Collect, Till) per the dashboard's channel taxonomy.
- **Commission** = real aggregator sales × 27% (assumption; flagged throughout).
- All figures pulled live from Supabase `vm_*` tables on 30 June 2026.
