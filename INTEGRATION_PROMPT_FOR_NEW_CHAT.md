# VM Analytics Module Integration — Complete Prompt for New Chat Session

## Project Context

You are helping integrate a **VM Analytics Dashboard module** (from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next`) into an existing **Next.js project** (`C:\NextJs\peckers-cashflow`).

### Current Status
- ✅ Database schema documented: `C:\Users\landa\Claude\Projects\Peckers\DATABASE_SCHEMA.md`
- ✅ KPI views created in Supabase: `sql/kpi_views.sql`
- ✅ Integration plan created: `C:\NextJs\peckers-cashflow\VM_ANALYTICS_INTEGRATION_PLAN.md`
- ✅ VM Analytics dashboard app built: `C:\Users\landa\Claude\Projects\Peckers\dashboard-next`
- ⏳ **NEXT:** Implement the integration into peckers-cashflow

---

## Project Details

### Peckers Cashflow Project
**Location:** `C:\NextJs\peckers-cashflow`  
**Tech Stack:** Next.js 14.2.35, TypeScript, Tailwind CSS, Recharts, @supabase/ssr  
**Structure:**
- Route groups: `(auth)`, `(protected)`, `manager`, `employee`
- Three portals: admin, manager, employee
- Auth: Supabase with role-based access control
- Middleware: Enforces auth + portal isolation

**Key Files:**
- `middleware.ts` — Auth enforcement, role-based routing
- `app/layout.tsx` — Root layout with theme, toast, progress bar
- `app/(protected)/layout.tsx` — Protected area layout
- `lib/` — Supabase clients, auth headers, utilities
- `components/` — Shared UI components (accounts, alerts, analytics, etc.)
- `.env.local.example` — Environment template

### VM Analytics Dashboard
**Location:** `C:\Users\landa\Claude\Projects\Peckers\dashboard-next`  
**Standalone App:** Complete Next.js dashboard (separate Supabase project)  
**Five Dashboards:**
1. Executive (KPIs across both stores)
2. Product Performance (menu items, categories)
3. Daypart Analysis (hourly/weekday trading patterns)
4. Delivery Platform Performance (channel breakdown)
5. Store Comparison (Hitchin vs Stevenage)

**Key Features:**
- Rule-based commentary generator (`lib/insights.ts`)
- Claude-powered commentary upgrade (when `ANTHROPIC_API_KEY` is set)
- Recharts visualizations
- Responsive design with Tailwind CSS

---

## Integration Architecture

### Decision: Completely Isolated Module
- **Route:** `app/(vm-analytics)/vm-analytics/*` — separate route group
- **Auth:** No auth checks; direct access (separate from cashflow's auth)
- **Supabase:** Completely separate project with distinct env vars
- **Components:** Isolated in `components/vm-analytics/`
- **Rollback:** Delete 3 folders + remove 4 env vars = clean removal

### Why This Approach?
1. ✅ VM Analytics queries a different Supabase database
2. ✅ Doesn't interfere with cashflow's auth or data
3. ✅ Easy to remove/update independently
4. ✅ Clean separation of concerns
5. ✅ No shared state or dependencies

---

## Integration Implementation Steps

### PHASE 1: Prepare Environment & Dependencies

#### Step 1.1: Update `package.json`
**File:** `C:\NextJs\peckers-cashflow\package.json`

Add `@anthropic-ai/sdk` to dependencies:

```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.32.1",
  "@supabase/ssr": "^0.5.2",
  "@supabase/supabase-js": "^2.45.4",
  "next": "14.2.35",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "recharts": "^2.13.0"
}
```

Then run:
```bash
npm install
```

#### Step 1.2: Update `.env.local.example`
**File:** `C:\NextJs\peckers-cashflow\.env.local.example`

Append at the bottom:

```bash
# ============================================================================
# VM Analytics Module — separate Supabase project (NOT the cashflow DB)
# ============================================================================
NEXT_PUBLIC_VM_SUPABASE_URL=https://[your-vm-supabase-project].supabase.co
NEXT_PUBLIC_VM_SUPABASE_ANON_KEY=[your-vm-supabase-anon-key]

# Optional: Claude-powered insights (if set, commentary is Claude-written; otherwise rule-based)
ANTHROPIC_API_KEY=[your-anthropic-api-key]
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

Then update your `.env.local` with the actual values from your VM Analytics Supabase project.

---

### PHASE 2: Create VM Analytics Module Structure & Lib

#### Step 2.1: Create directories

```bash
mkdir -p app/(vm-analytics)/vm-analytics/{executive,products,daypart,delivery,store-comparison}
mkdir -p lib/vm-analytics
mkdir -p components/vm-analytics
```

#### Step 2.2: Create isolated Supabase client

**File:** `C:\NextJs\peckers-cashflow\lib\vm-analytics\client.ts`

```typescript
// Isolated Supabase client for VM Analytics (separate project, separate creds)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getVMSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_VM_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_VM_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing VM Analytics Supabase config. " +
      "Add NEXT_PUBLIC_VM_SUPABASE_URL and NEXT_PUBLIC_VM_SUPABASE_ANON_KEY to .env.local"
    );
  }

  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}
```

#### Step 2.3: Copy VM Analytics lib files

Copy these files from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next\lib\` to `C:\NextJs\peckers-cashflow\lib\vm-analytics\`:

- `constants.ts`
- `format.ts`
- `types.ts`
- `queries.ts` (with modifications below)
- `insights.ts`

**IMPORTANT:** Update `queries.ts`:

Replace the first import:
```typescript
// OLD
import { getSupabaseServer } from "@/lib/supabase/server";

// NEW
import { getVMSupabaseServer } from "@/lib/vm-analytics/client";
```

Replace all `getSupabaseServer()` calls:
```typescript
// OLD
const sb = getSupabaseServer();

// NEW
const sb = getVMSupabaseServer();
```

#### Step 2.4: Copy VM Analytics components

Copy the entire `components/` folder from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next\components\` to `C:\NextJs\peckers-cashflow\components\vm-analytics\`:

Expected structure after copy:
```
components/vm-analytics/
├── KpiCard.tsx
├── DataTable.tsx
├── Section.tsx
├── Commentary.tsx
├── PageState.tsx
├── charts/
│   └── Charts.tsx
└── nav/
    ├── DashboardSelector.tsx
    └── WeekSelector.tsx
```

---

### PHASE 3: Create Route Handlers & Pages

#### Step 3.1: Create layout for VM Analytics root

**File:** `C:\NextJs\peckers-cashflow\app\(vm-analytics)\layout.tsx`

```typescript
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "VM Analytics — Peckers",
  description: "Weekly performance analytics dashboard",
};

export default function VmAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

#### Step 3.2: Create layout for VM Analytics module

**File:** `C:\NextJs\peckers-cashflow\app\(vm-analytics)\vm-analytics\layout.tsx`

Copy from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next\app\vm-analytics\layout.tsx`

**Update all imports** in this file to use `vm-analytics` paths:
```typescript
// OLD
import { DashboardSelector } from "@/components/nav/DashboardSelector";
import { WeekSelector } from "@/components/nav/WeekSelector";

// NEW
import { DashboardSelector } from "@/components/vm-analytics/nav/DashboardSelector";
import { WeekSelector } from "@/components/vm-analytics/nav/WeekSelector";
```

#### Step 3.3: Copy all page files

Copy these files from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next\app\vm-analytics\` to `C:\NextJs\peckers-cashflow\app\(vm-analytics)\vm-analytics\`:

- `page.tsx`
- `executive/page.tsx`
- `products/page.tsx`
- `daypart/page.tsx`
- `delivery/page.tsx`
- `store-comparison/page.tsx`

**Update ALL imports in each page file:**

```typescript
// OLD
import { getExec, ... } from "@/lib/queries";
import { ... } from "@/lib/insights";
import { KpiCard, ... } from "@/components/KpiCard";
import { Commentary } from "@/components/Commentary";
import { ... } from "@/components/charts/Charts";
import { Section, ... } from "@/components/Section";

// NEW
import { getExec, ... } from "@/lib/vm-analytics/queries";
import { ... } from "@/lib/vm-analytics/insights";
import { KpiCard, ... } from "@/components/vm-analytics/KpiCard";
import { Commentary } from "@/components/vm-analytics/Commentary";
import { ... } from "@/components/vm-analytics/charts/Charts";
import { Section, ... } from "@/components/vm-analytics/Section";
```

#### Step 3.4: Create Insights API route

**File:** `C:\NextJs\peckers-cashflow\app\api\vm-analytics\insights\route.ts`

Copy the entire contents from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next\app\api\insights\route.ts` (no changes needed).

---

### PHASE 4: Update Root CSS (if needed)

If VM Analytics components use any CSS classes not in cashflow's Tailwind:

**File:** `C:\NextJs\peckers-cashflow\app\globals.css`

Add at the bottom (these are for dashboard cards):
```css
.table-scroll::-webkit-scrollbar {
  height: 8px;
}
.table-scroll::-webkit-scrollbar-thumb {
  @apply bg-slate-300 rounded-full;
}
```

---

### PHASE 5: Test & Verify

#### Step 5.1: Install and start dev server

```bash
cd C:\NextJs\peckers-cashflow
npm install
npm run dev
```

#### Step 5.2: Access the dashboard

Open in your browser:
```
http://localhost:3000/vm-analytics/executive
```

**Expected:** VM Analytics dashboard loads with week picker and KPI cards.

#### Step 5.3: Test all dashboards

Navigate through:
- `/vm-analytics/executive` — Executive Dashboard
- `/vm-analytics/products` — Product Performance
- `/vm-analytics/daypart` — Daypart Analysis
- `/vm-analytics/delivery` — Delivery Platform Performance
- `/vm-analytics/store-comparison` — Store Comparison

**Expected:** All load without errors and pull data from your VM Analytics Supabase.

#### Step 5.4: Test insights API (optional)

```bash
curl -X POST http://localhost:3000/api/vm-analytics/insights \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "dashboard": "executive",
      "week": "2026-06-01",
      "totalWow": 7.4,
      "stores": [...]
    }
  }'
```

**Expected:** Returns JSON with `source: "rules"` or `source: "claude"` (if key is set).

---

## Database Prerequisites

Before testing, ensure your VM Analytics Supabase has:

1. **Raw data tables** synced from VM Hub (via `npm run sync` in vm-extractor)
2. **KPI views** created by running `sql/kpi_views.sql`

If not done yet, run in vm-extractor:
```bash
cd C:\Users\landa\Claude\Projects\Peckers\vm-extractor
npm run sync
psql "$SUPABASE_DB_URL" -f sql/kpi_views.sql
```

---

## File Structure After Integration

```
peckers-cashflow/
├── app/
│   ├── (auth)/
│   ├── (protected)/
│   ├── (vm-analytics)/                ← NEW
│   │   └── vm-analytics/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── executive/page.tsx
│   │       ├── products/page.tsx
│   │       ├── daypart/page.tsx
│   │       ├── delivery/page.tsx
│   │       └── store-comparison/page.tsx
│   ├── api/
│   │   └── vm-analytics/              ← NEW
│   │       └── insights/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ... existing ...
│   └── vm-analytics/                  ← NEW
│       ├── KpiCard.tsx
│       ├── DataTable.tsx
│       ├── Section.tsx
│       ├── Commentary.tsx
│       ├── PageState.tsx
│       ├── charts/Charts.tsx
│       └── nav/
│           ├── DashboardSelector.tsx
│           └── WeekSelector.tsx
├── lib/
│   ├── ... existing (auth, cash-flow, etc) ...
│   └── vm-analytics/                  ← NEW
│       ├── client.ts
│       ├── constants.ts
│       ├── format.ts
│       ├── types.ts
│       ├── queries.ts
│       └── insights.ts
├── middleware.ts
├── .env.local (updated with VM vars)
├── .env.local.example (updated)
├── package.json (added @anthropic-ai/sdk)
├── tsconfig.json
└── VM_ANALYTICS_INTEGRATION_PLAN.md
```

---

## Troubleshooting Guide

### Error: "Missing VM Analytics Supabase config"
**Cause:** Environment variables not set  
**Fix:** Update `.env.local` with `NEXT_PUBLIC_VM_SUPABASE_URL` and `NEXT_PUBLIC_VM_SUPABASE_ANON_KEY`

### Error: "Cannot find module '@/lib/vm-analytics/queries'"
**Cause:** Import path typo or file not copied  
**Fix:** Check that `lib/vm-analytics/queries.ts` exists and import path matches

### Dashboard shows "No data for this week"
**Cause:** Data not synced or SQL views not created  
**Fix:** Run `npm run sync` in vm-extractor, then `psql ... -f sql/kpi_views.sql`

### Build fails with TypeScript errors
**Cause:** Missing type definitions or import mismatches  
**Fix:** Run `npm run build` locally to see full error, then check `types.ts` is copied correctly

---

## Quick Command Reference

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build production
npm run build

# Lint
npm run lint

# Test a specific dashboard (browser)
# http://localhost:3000/vm-analytics/executive
```

---

## Rollback Instructions (if needed)

To completely remove VM Analytics:

1. Delete folders:
   ```bash
   rm -r app/(vm-analytics)
   rm -r app/api/vm-analytics
   rm -r lib/vm-analytics
   rm -r components/vm-analytics
   ```

2. Remove from `.env.local`:
   - `NEXT_PUBLIC_VM_SUPABASE_URL`
   - `NEXT_PUBLIC_VM_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`

3. Remove from `package.json`:
   - `"@anthropic-ai/sdk": "^0.32.1"`

4. Revert `.env.local.example` and `package.json` from git

5. Run:
   ```bash
   npm install
   npm run dev
   ```

**Result:** Cashflow runs as if VM Analytics was never added.

---

## Key Isolation Guarantees

✅ **Supabase:**
- Cashflow: `NEXT_PUBLIC_SUPABASE_URL/KEY`
- VM Analytics: `NEXT_PUBLIC_VM_SUPABASE_URL/KEY`
- No shared queries or clients

✅ **Auth:**
- Cashflow: Middleware enforces auth + roles
- VM Analytics: No auth; direct access

✅ **Components:**
- Cashflow: Uses existing `components/*`
- VM Analytics: All in `components/vm-analytics/*`
- No cross-imports

✅ **Routes:**
- Cashflow: `(protected)`, `(auth)`, `manager`, `employee`
- VM Analytics: `(vm-analytics)` — completely separate

---

## Testing Checklist

- [ ] npm install completes
- [ ] npm run dev starts successfully
- [ ] Cashflow dashboard works (`/dashboard`)
- [ ] VM Analytics loads (`/vm-analytics/executive`)
- [ ] Week picker works
- [ ] All 5 dashboards render
- [ ] Click between dashboards in dropdown
- [ ] Insights API responds
- [ ] npm run build succeeds
- [ ] No TypeScript errors in console

---

## Total Integration Time

- **Phase 1:** 5 min (env setup)
- **Phase 2:** 5 min (copy lib/components)
- **Phase 3:** 5 min (copy routes)
- **Phase 4:** 1 min (CSS)
- **Phase 5:** 5 min (test)

**Total:** ~20 minutes

---

## Next Steps After Integration

1. **Optional:** Add link to VM Analytics in the protected layout nav
2. **Optional:** Add password protection if needed
3. **Optional:** Customize colors/branding to match cashflow theme
4. **Monitor:** Check that both cashflow and VM Analytics work together

---

## Contact/Notes

- Source dashboard: `C:\Users\landa\Claude\Projects\Peckers\dashboard-next`
- Integration plan: `C:\NextJs\peckers-cashflow\VM_ANALYTICS_INTEGRATION_PLAN.md`
- Database schema: `C:\Users\landa\Claude\Projects\Peckers\DATABASE_SCHEMA.md`
- Critical error fixed: `vm_num()` function regex updated to handle ranges

---

## Ready to Start?

Follow the steps above in order. Each phase is independent, so you can pause and resume.

If you get stuck, check the **Troubleshooting Guide** section above.

Good luck! 🚀
