# VM Analytics Module Integration Plan

## Project Overview
**Existing Project:** `C:\NextJs\peckers-cashflow` (Next.js 14, TypeScript, Tailwind)  
**New Module:** VM Analytics Dashboard (from `C:\Users\landa\Claude\Projects\Peckers\dashboard-next`)  
**Integration Goal:** Add VM Analytics as a completely isolated feature with its own Supabase instance

---

## Architecture Decision

### ✅ CHOSEN APPROACH: Completely Isolated Module
- **Location:** `app/(vm-analytics)/*` — separate route group, not under `(protected)`
- **Auth:** No auth checks; accessible directly (or you can add a simple password protection later)
- **Supabase:** Completely separate Supabase project with distinct env vars
- **Components:** Reuse UI framework (Tailwind) but not any cashflow components
- **Navigation:** Optional link in protected layout (can be added later or left out)

**Rationale:** Cleanest separation. VM Analytics is a business intelligence tool for a different database, so it shouldn't share auth/supabase with the cashflow operational system.

---

## Integration Steps

### Phase 1: Prepare Environment & Dependencies

#### Step 1.1: Update `package.json`
Add missing dependency (your dashboard-next already has it, but ensure cashflow has it too):

**In `C:\NextJs\peckers-cashflow\package.json`**, add to `dependencies`:
```json
"@anthropic-ai/sdk": "^0.32.1"
```

**Before:**
```json
"dependencies": {
  "@supabase/ssr": "^0.5.2",
  "@supabase/supabase-js": "^2.45.4",
  "next": "14.2.35",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "recharts": "^2.13.0"
}
```

**After:**
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

Add VM Analytics env vars. **In `C:\NextJs\peckers-cashflow\.env.local.example`**, append at the bottom:

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

Then copy these to your actual `.env.local` and fill in the values from your VM Analytics Supabase project.

---

### Phase 2: Create VM Analytics Module Structure

#### Step 2.1: Create directories
```bash
mkdir -p app/(vm-analytics)/vm-analytics/{executive,products,daypart,delivery,store-comparison}
mkdir -p lib/vm-analytics
mkdir -p components/vm-analytics
```

#### Step 2.2: Create `lib/vm-analytics/` — isolated Supabase client

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
- `queries.ts` — update to use `getVMSupabaseServer()` instead of `getSupabaseServer()`
- `insights.ts`

**File to modify:** `C:\NextJs\peckers-cashflow\lib\vm-analytics\queries.ts`

Change the import at the top:
```typescript
// OLD
import { getSupabaseServer } from "@/lib/supabase/server";

// NEW
import { getVMSupabaseServer } from "@/lib/vm-analytics/client";
```

And update all function calls:
```typescript
// OLD
const sb = getSupabaseServer();

// NEW
const sb = getVMSupabaseServer();
```

#### Step 2.4: Copy VM Analytics components

Copy the entire `components/` folder from `dashboard-next` to `C:\NextJs\peckers-cashflow\components\vm-analytics\`:

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

### Phase 3: Create Route Handlers

#### Step 3.1: Create layout for VM Analytics module

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

#### Step 3.2: Create VM Analytics routes page

**File:** `C:\NextJs\peckers-cashflow\app\(vm-analytics)\vm-analytics\layout.tsx`

Copy from `dashboard-next/app/vm-analytics/layout.tsx` with one change:

Replace all imports like:
```typescript
// OLD
import { DashboardSelector } from "@/components/nav/DashboardSelector";

// NEW
import { DashboardSelector } from "@/components/vm-analytics/nav/DashboardSelector";
```

#### Step 3.3: Create page files

Copy these files from `dashboard-next/app/vm-analytics/` to `C:\NextJs\peckers-cashflow\app\(vm-analytics)\vm-analytics\`:

- `page.tsx`
- `executive/page.tsx`
- `products/page.tsx`
- `daypart/page.tsx`
- `delivery/page.tsx`
- `store-comparison/page.tsx`

**Update imports in each file:**
```typescript
// OLD
import { getExec, ... } from "@/lib/queries";
import { KpiCard, ... } from "@/components/KpiCard";

// NEW
import { getExec, ... } from "@/lib/vm-analytics/queries";
import { KpiCard, ... } from "@/components/vm-analytics/KpiCard";
```

#### Step 3.4: Create Insights API route

**File:** `C:\NextJs\peckers-cashflow\app\api\vm-analytics\insights\route.ts`

Copy from `dashboard-next/app/api/insights/route.ts` (same code, no changes needed).

---

### Phase 4: Update Root Layout (Optional Navigation)

#### Step 4.1: Add VM Analytics link to protected layout

**File:** `C:\NextJs\peckers-cashflow\app\(protected)\layout.tsx`

Add this navigation item (find where the sidebar/nav is defined and add):

```typescript
// In the navigation menu, add:
<Link href="/vm-analytics/executive">
  <span className="flex items-center gap-2">
    <ChartIcon />
    VM Analytics
  </span>
</Link>
```

(Only if you want it accessible from the dashboard; you can skip this and access it directly at `/vm-analytics/executive`)

---

### Phase 5: Run & Test

#### Step 5.1: Install and start

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

You should see the VM Analytics dashboard pulling from your **separate** Supabase project.

---

## File Structure Summary

After integration, your project will look like:

```
peckers-cashflow/
├── app/
│   ├── (auth)/
│   ├── (protected)/
│   │   └── ... existing routes ...
│   ├── (vm-analytics)/              ← NEW
│   │   └── vm-analytics/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── executive/
│   │       ├── products/
│   │       ├── daypart/
│   │       ├── delivery/
│   │       └── store-comparison/
│   ├── api/
│   │   └── vm-analytics/            ← NEW
│   │       └── insights/
│   │           └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ... existing ...
│   └── vm-analytics/                ← NEW
│       ├── KpiCard.tsx
│       ├── DataTable.tsx
│       ├── Section.tsx
│       ├── Commentary.tsx
│       ├── PageState.tsx
│       ├── charts/
│       └── nav/
├── lib/
│   ├── ... existing (auth, cash-flow, etc) ...
│   └── vm-analytics/                ← NEW
│       ├── client.ts
│       ├── constants.ts
│       ├── format.ts
│       ├── types.ts
│       ├── queries.ts
│       └── insights.ts
├── .env.local
├── package.json
└── tsconfig.json
```

---

## Key Isolation Points

### ✅ Supabase Isolation
- **Cashflow:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **VM Analytics:** `NEXT_PUBLIC_VM_SUPABASE_URL`, `NEXT_PUBLIC_VM_SUPABASE_ANON_KEY`
- Separate client factory: `getVMSupabaseServer()` vs `getSupabaseServer()`
- No shared queries or data models

### ✅ Auth Isolation
- **Cashflow:** Protected by middleware, role-based access to cashflow data
- **VM Analytics:** No auth checks; direct access (add password protection if needed later)

### ✅ Component Isolation
- **Shared:** Tailwind CSS, theme provider, layout patterns
- **Isolated:** All VM Analytics components in `components/vm-analytics/`
- **No imports between:** cashflow components never import vm-analytics

### ✅ Routing Isolation
- **Cashflow:** `(protected)`, `(auth)`, `manager`, `employee` route groups
- **VM Analytics:** Separate `(vm-analytics)` route group
- No route conflicts

---

## Rollback Plan

If you need to remove VM Analytics later:

1. Delete folders:
   - `app/(vm-analytics)`
   - `app/api/vm-analytics`
   - `lib/vm-analytics`
   - `components/vm-analytics`

2. Remove from `.env.local`:
   - `NEXT_PUBLIC_VM_SUPABASE_URL`
   - `NEXT_PUBLIC_VM_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`

3. Remove from `package.json`:
   - `@anthropic-ai/sdk`

4. Run `npm install` and restart

**That's it.** No changes to existing cashflow code.

---

## Deployment Notes

### For Vercel / production:

1. Add env vars to your deployment platform:
   - `NEXT_PUBLIC_VM_SUPABASE_URL`
   - `NEXT_PUBLIC_VM_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (optional)
   - `ANTHROPIC_MODEL`

2. The SQL views must exist in your VM Analytics Supabase:
   - Run `C:\Users\landa\Claude\Projects\Peckers\vm-extractor\sql\kpi_views.sql`

3. No changes to existing env vars or cashflow routes.

---

## FAQ

**Q: Can I reuse cashflow's navigation/layout?**  
A: Yes, but it's cleaner to keep VM Analytics self-contained. The dashboard has its own sidebar layout.

**Q: Do I need to auth users for VM Analytics?**  
A: No, it's read-only data. If you want auth, you can add a simple password protect later.

**Q: Can I add VM Analytics link to the cashflow sidebar?**  
A: Yes, add a link to `/vm-analytics/executive` in the protected layout nav.

**Q: What if I want to move VM Analytics later?**  
A: Just change the route group name from `(vm-analytics)` to something else; all imports are relative.

**Q: How do I update the dashboard without affecting cashflow?**  
A: Replace files in `components/vm-analytics/` and `lib/vm-analytics/` — completely isolated.

---

## Testing Checklist

- [ ] npm install completes without errors
- [ ] npm run dev starts successfully
- [ ] Cashflow dashboard still works (`/dashboard`)
- [ ] VM Analytics loads (`/vm-analytics/executive`)
- [ ] Week picker works
- [ ] All 5 dashboards render (executive, products, daypart, delivery, store-comparison)
- [ ] Insights API responds (`/api/vm-analytics/insights`)
- [ ] Build passes: `npm run build`

---

## Ready to Implement?

Follow the steps above in order. Each phase is independent, so you can pause at any point. 

**Total integration time:** ~20 minutes (copy files + update imports + test).

Good luck! 🚀
