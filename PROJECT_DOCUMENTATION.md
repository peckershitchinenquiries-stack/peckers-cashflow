# Peckers Cash Flow — Complete Project Documentation

> Last updated: June 2026  
> Author: WEBCROS  
> Purpose: Single reference document covering every feature, every user type, every flow, and every technical decision in the application.

---

## Table of Contents

1. [What Is This Application?](#1-what-is-this-application)
2. [The Problem It Solves](#2-the-problem-it-solves)
3. [Tech Stack](#3-tech-stack)
4. [User Types & Roles](#4-user-types--roles)
5. [Complete Feature List](#5-complete-feature-list)
6. [User Flows — Admin](#6-user-flows--admin)
7. [User Flows — Manager](#7-user-flows--manager)
8. [User Flows — Employee](#8-user-flows--employee)
9. [Database Architecture](#9-database-architecture)
10. [Authentication & Security Model](#10-authentication--security-model)
11. [Business Logic Deep Dive](#11-business-logic-deep-dive)
12. [Alert System](#12-alert-system)
13. [Project Structure (File Map)](#13-project-structure-file-map)
14. [Server Actions Reference](#14-server-actions-reference)
15. [Configuration & Settings](#15-configuration--settings)
16. [Data Flows End-to-End](#16-data-flows-end-to-end)
17. [Deployment Setup](#17-deployment-setup)

---

## 1. What Is This Application?

**Peckers Cash Flow** is a full-stack internal web application built for the **Peckers** restaurant/takeaway group, which operates two UK stores — **Stevenage** and **Hitchin**.

It is a combined **workforce management + cash-flow reconciliation** system that replaces spreadsheets and manual processes. The application handles:

- Employee scheduling (rota), attendance (clock-in/out with GPS), and weekly pay calculation
- Daily cash reconciliation between point-of-sale (Vita Mojo) and physical envelopes
- Weekly Saturday wage payout summaries with bank vs. cash wage splits
- Real-time alerts for operational anomalies (late clock-ins, missing entries, wage violations, etc.)
- Audit trails for compliance
- Multi-role access for admin, store managers, and individual employees

The application is entirely private — access is restricted to a whitelist maintained by the admin. There is no public sign-up.

---

## 2. The Problem It Solves

Peckers had two core operational pain points:

### Pain Point 1: Cash Wage Payout Complexity

UK restaurants paying part of wages in cash face a weekly reconciliation problem:

1. Cash comes into the register every day from customer sales (tracked by the Vita Mojo POS system)
2. Physical cash is collected in envelopes at end of each shift
3. On Saturday, the manager must calculate:
   - How much cash is physically available
   - How much is owed in cash wages (partial-cash model: first 20 hrs = PAYE/bank, remainder = cash)
   - How much to draw from the Post Office if short
   - How much surplus to carry forward if over
4. Individual staff members may also be drivers earning a per-delivery rate on top of hourly wages

Previously this was done manually on paper. Errors were frequent, reconciliation took hours, and there was no audit trail.

### Pain Point 2: Workforce Scheduling & Attendance

Managing shifts across two stores, tracking actual worked hours against scheduled hours, and ensuring on-site attendance (not remote clock-ins) required a system that:

- Enforces GPS-validated clock-in/out (geofencing within 250m of store)
- Compares actual vs. scheduled hours for variance detection
- Tracks delivery counts for driver payout
- Detects no-shows, late arrivals, and early departures automatically

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Frontend | React 18, Tailwind CSS, Recharts |
| Backend | Next.js Server Actions (no separate API layer) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth (email+password for admin; synthetic credentials for staff) |
| Email | Resend (alert digests, optional) |
| Deployment | Vercel |
| Currency | GBP (£), 2 decimal precision |
| Date format | dd/mm/yyyy display; YYYY-MM-DD stored internally |
| Locale | UK (timezone, minimum wage law, NI/PAYE terminology) |

**Design language:** Dark theme, gold accent (`#c9a84c`), mobile-first responsive layout with bottom navigation on mobile and sidebar on desktop.

---

## 4. User Types & Roles

There are exactly three roles in the system. Each role gets its own isolated portal (separate URL paths, separate navigation, separate database visibility enforced at the Postgres RLS level).

### 4.1 Admin

- **Who:** Business owner or senior ops lead for the whole Peckers group
- **Portal path:** `/dashboard`, `/employees`, `/rota`, `/live`, `/cash-flow`, `/analytics`, `/alerts`, `/settings`
- **Scope:** All stores, all employees, all data
- **Special powers:** Provision manager and employee accounts, manage the login whitelist, configure global settings (alert thresholds, min-wage bands, carry-forward policy), view full audit log

### 4.2 Manager

- **Who:** Store manager at Stevenage or Hitchin
- **Portal path:** `/manager/live`, `/manager/cash-flow`, `/manager/employees`, `/manager/rota`, `/manager/analytics`, `/manager/alerts`, `/manager/settings`
- **Scope:** Own store only (enforced by database policy — they cannot see or touch data from the other store)
- **Login:** Uses a system-generated `username + password` (not a personal email). Synthetic email `firstname.lastname@staff.peckers-app.co.uk` is created internally.
- **Special powers:** Enter daily cash entries, view payout previews, manage employee schedules, resolve alerts for their store

### 4.3 Employee

- **Who:** Kitchen or counter staff, drivers
- **Portal path:** `/employee/attendance`, `/employee/shifts`, `/employee/profile`, `/employee/settings`
- **Scope:** Own records only (own schedule, own clock events, own profile)
- **Login:** Same username+password system as managers
- **Special powers:** Clock in/out (GPS-validated), log delivery count, update own profile and bank details

---

## 5. Complete Feature List

### Authentication & Access Control
- Whitelist-only login (no public sign-up)
- Three isolated portals (admin / manager / employee)
- Forced password change on first login (for provisioned accounts)
- Session-based auth with Supabase (JWT tokens)
- Row Level Security on every database table
- Audit log of all mutations

### Workforce Management
- Employee profiles (personal info, position, pay rates, bank details, employment dates)
- Weekly recurring schedule templates (per employee, per weekday)
- Live rota (specific dates, overrides template)
- Auto-rota generation from schedule templates
- Same-day edit protection (reason required if editing today's shift after it starts)
- GPS-validated clock-in and clock-out
- Geofencing (store location + configurable radius, default 250m)
- Manual clock override by manager
- Delivery count tracking per shift (for drivers)
- Weekly delivery performance tracking (4-week rolling average)

### Cash Flow & Payroll
- Daily cash entry: Vita Mojo POS sales vs physical envelope amount
- Discrepancy flagging (reason mandatory when difference exists)
- Late entry flagging (submitted after 23:00)
- Per-store daily totals and running weekly totals
- Saturday pre-payment summary (live preview)
- Bank/NI vs cash wage split (first 20 hrs = bank, remainder = cash)
- Delivery wage calculation (per-driver, per-delivery rate)
- Opening balance carry-forward
- Post Office draw calculation (when cash available < wages owed)
- Payout confirmation and locking (locked record = immutable history)
- Payout history view

### Alerts & Notifications
- 14 alert types covering wage, attendance, delivery, and cash anomalies
- Severity levels: info / warning / critical
- Alert deduplication (no duplicate open alerts for same event)
- Manager alert resolution with notes
- Optional email digest via Resend

### Analytics
- Weekly and monthly trend views
- Wage variance charts (scheduled vs actual)
- Delivery performance charts
- Store-vs-store comparison (admin only)
- KPI summary tiles (daily/weekly sales, hours, wages)

### Settings & Configuration
- Alert thresholds (all percentages and minute-offsets configurable)
- UK minimum wage bands (NLW/NMW, age-based, updated April each year)
- Cash flow policy (carry-forward on/off, entry cutoff hour, payout confirm hour)
- Email alert recipients
- Store locations and geofence radius
- Allowed users whitelist (add, remove, reassign roles)
- App appearance (light/dark theme)

---

## 6. User Flows — Admin

The admin has unrestricted access to all data across both stores. Below is every key flow an admin performs.

### 6.1 First-Time Setup

1. Admin opens the app and navigates to `/settings` → **Allowed Users** tab
2. Sees only their own email in the whitelist (added during initial Supabase setup)
3. Navigates to **Stores** tab — Stevenage and Hitchin are pre-seeded with coordinates and default 250m radius
4. Navigates to **Settings** tab to confirm alert thresholds and minimum wage bands are correct for the current tax year

### 6.2 Provisioning a Manager Account

1. Admin navigates to `/managers` (Managers section in sidebar)
2. Clicks **Add Manager**
3. Fills in:
   - Manager's full name
   - Which store they manage (Stevenage or Hitchin)
4. System automatically:
   - Generates a username (e.g., `pavan.kumar`)
   - Generates a temporary password (random 8-char alphanumeric)
   - Creates a Supabase Auth user with synthetic email `pavan.kumar@staff.peckers-app.co.uk`
   - Inserts row into `allowed_users` with `role = "manager"` and the `store_id`
   - Sets `must_change_password = true`
5. Admin sees a **Credentials Modal** showing the username and temporary password
6. Admin shares these credentials with the manager (manually — via WhatsApp, text, etc.)
7. Manager logs in at `/manager/login`, enters username + temporary password
8. System detects `must_change_password = true`, redirects to `/change-password`
9. Manager sets a new personal password — flag is cleared, they land on `/manager/live`

### 6.3 Adding an Employee

1. Admin (or manager — see Manager flows) navigates to `/employees`
2. Clicks **Add Employee**
3. Fills in the **Add Employee modal**:
   - Personal: Name (required), phone, date of birth, gender, position (Kitchen/Counter/Driver/Other)
   - Employment: Employment start date, joined date, employment status
   - Pay rates: Hourly rate, hourly NI rate, hourly cash rate, delivery rate (for drivers), bank weekly hours limit (default 20)
   - Store assignment
   - Notes (internal)
4. Employee is created — profile exists but they have no login yet
5. Admin clicks **Provision Account** on the employee's card
6. System generates username + temporary password, creates auth user, links `auth_user_id` to the employee record
7. Admin shares credentials; employee logs in, forced to change password

### 6.4 Editing an Employee Profile

1. Admin navigates to `/employees`, finds the employee card
2. Clicks **Edit** to open the **Edit Employee Modal**
3. Can update any field including pay rates
4. On save:
   - Changes are written to `employees` table
   - An audit log entry is written: `{ action: "employee_update", entity: "employee", changes: { field: { old, new } } }`
   - If pay rate changed, future hours logged will use new rate (existing week entries keep their snapshotted rate)
5. Changes in hourly rates trigger a min-wage compliance check — if rate is below legal minimum for employee's age, a `min_wage_violation` alert is created

### 6.5 Logging Employee Hours (Manual)

1. Admin goes to the employee's detail page, clicks the **Hours** tab
2. Selects week start date (Monday of the relevant week)
3. Enters total hours worked
4. System auto-calculates:
   - Bank hours = min(total, `bank_weekly_hours_limit`, e.g. 20)
   - Cash hours = total − bank hours
   - Cash amount = cash hours × `hourly_cash_rate`
5. Confirms save — entry is upserted with a snapshot of the current hourly rate
6. Running totals update on the Hours Table

### 6.6 Managing the Rota (Admin)

1. Admin navigates to `/rota`
2. Sees a week-view grid: rows = employees, columns = Mon–Sun
3. Can switch stores using a store selector
4. **Edit a shift:** Clicks a cell to open **Shift Edit Modal**
   - Set start/end time, or mark as Day Off
   - If editing same-day shift after it has started, must enter a reason
5. **Generate rota:** Clicks "Generate Rota" → provides store, start date, number of weeks
   - System reads each employee's recurring `employee_schedules` template
   - Creates `rota_shifts` rows for each working day in the range
   - Does not overwrite existing shifts (skips conflicts)
6. Rota is visible to managers and employees immediately

### 6.7 Viewing the Live Dashboard

1. Admin navigates to `/live`
2. Sees all employees across all stores (or filter by store)
3. For each employee:
   - Scheduled shift start/end
   - Clock-in time (or "Not yet clocked in")
   - Clock-out time (or "Currently working")
   - Computed worked hours so far today
   - GPS coordinates of clock-in (for audit)
4. Colour coding:
   - Green: clocked in on time
   - Amber: late clock-in (> 15 min after scheduled start)
   - Red: scheduled but not clocked in (no-show)
   - Grey: day off or no shift scheduled
5. Page refreshes automatically (30-second polling)

### 6.8 Cash Flow — Admin Overview

1. Admin navigates to `/cash-flow`
2. Sees a week-summary dashboard for both stores side by side
3. For each store, sees:
   - Daily entries for the week (envelope amounts, Vita Mojo sales, differences)
   - Weekly total cash collected
   - Payout status (draft / confirmed)
4. Clicks into a store to see the full **Pre-Payment View** (same as manager sees — see §7.4)
5. Can also view **Payout History** — all confirmed payouts with full breakdown

### 6.9 Settings & Configuration

1. Admin navigates to `/settings`
2. Four tabs:

**Alert Thresholds:**
- Wage variance percentage (default 20%)
- Delivery spike multiplier (default 1.5×)
- Late clock-in minutes (default 15)
- Absence trigger minutes (default 60)
- Early clock-out minutes (default 30)
- Scheduled vs actual variance percentage (default 25%)

**Minimum Wage:**
- Toggle compliance checking on/off
- NLW for 21+ (£12.21 for April 2025)
- Rate for 18–20 (£10.00)
- Rate for under 18 (£7.55)

**Cash Flow Policy:**
- Carry-forward surplus (yes/no)
- Hour at which missing-entry alert fires (default: 23)
- Hour at which unconfirmed-wages alert fires on Saturday (default: 18)

**Email Alerts:**
- Enable/disable email notifications
- List of recipient email addresses

3. Changes are saved to `app_settings` table — take effect immediately for all future alert scans

### 6.10 Audit Log

1. Admin navigates to `/settings` → **Audit Log** tab
2. Sees a chronological list of all mutations in the system:
   - Who performed it (actor email + name)
   - What action (create_employee, update_shift, confirm_payout, etc.)
   - What entity and ID was affected
   - What changed (JSON diff: old value → new value)
   - When (timestamp)
3. Cannot be edited or deleted — append-only compliance record

### 6.11 Managing Alerts

1. Admin navigates to `/alerts`
2. Sees all unresolved alerts across both stores, sorted by severity then timestamp
3. For each alert:
   - Title and message (human-readable description)
   - Severity badge (info / warning / critical)
   - Store name and linked employee/shift
   - Time created
4. Clicks **Resolve** → enters a resolution note → alert is marked resolved (timestamp + who resolved it recorded)
5. Can filter by store, severity, and alert type
6. Resolved alerts remain visible in history (never deleted)

---

## 7. User Flows — Manager

The manager's portal is a scoped version of the admin portal, restricted to their assigned store. They cannot see data from the other store.

### 7.1 Manager Login

1. Opens `/manager/login` in browser (different URL from admin login at `/login`)
2. Enters username (e.g., `pavan.kumar`) and password
3. Middleware looks up `allowed_users` by synthetic email, confirms `role = "manager"`, gets their `store_id`
4. Sets identity headers (`x-pk-allowed`) containing their user_id, email, role, store_id
5. Redirected to `/manager/live` (their home page)
6. If `must_change_password = true` (first login), redirected to `/change-password` first

### 7.2 Live Dashboard (Manager's Home Screen)

This is the manager's primary operational screen — they check this multiple times a day.

1. Opens `/manager/live`
2. Sees today's staffing grid for their store only:
   - Each scheduled employee
   - Clock-in status (on time / late / absent / working / done)
   - Actual hours vs. scheduled hours
   - Real-time GPS status of each clock-in
3. Sees a summary bar:
   - Total staff scheduled today
   - Total currently clocked in
   - Any active alerts (unresolved)
4. Can drill into any employee to see their detail
5. Page auto-refreshes every 30 seconds

### 7.3 Daily Cash Entry

This is done once per day (typically at end of shift), every day Mon–Sat.

1. Manager navigates to `/manager/cash-flow`
2. Sees the week's daily entry grid — each day shows:
   - Date
   - Vita Mojo Sales (from POS system — manager enters this number manually)
   - Envelope Amount (cash physically counted and put in the envelope)
   - Difference (auto-calculated: Vita Mojo − Envelope; positive = shortfall)
   - Reason (required if difference ≠ 0)
   - Submitted by / submitted at
3. **Entering a new day:**
   - Clicks on the empty row for today
   - Types Vita Mojo sales figure (from the end-of-day POS report)
   - Types envelope amount (counted cash)
   - If they differ, a **Reason** field appears and is mandatory
   - Common reasons: "Refund issued", "Counted wrong", "Till error", etc.
   - Submits → row saved with their name and timestamp
4. **Editing a previous entry:**
   - Clicks on an existing row
   - Makes changes (e.g., corrected figures after recount)
   - If difference now exists but didn't before (or vice versa), reason field updates accordingly
   - Saves → `edited_by_name` and `edited_at` fields updated
5. **Late entry:**
   - If submitted after 23:00, entry is flagged `is_late = true`
   - This generates a `missing_daily_entry` alert for the store (if not already entered by that time)

### 7.4 Pre-Payment Summary (Saturday)

The most important screen for the manager — used every Saturday to prepare the wage payout.

1. Manager navigates to `/manager/cash-flow` → **This Week's Payout** section
2. The system computes a live pre-payment summary:

**Step 1 — Opening Balance:**
- The confirmed surplus carried forward from last week's payout (if carry-forward is enabled in settings)
- If last week's payout was not confirmed, opening balance is £0

**Step 2 — Cash Collected This Week:**
- Sum of all daily envelope amounts for this week (Mon–Fri)
- Table shows each day's envelope amount

**Step 3 — Logged Differences:**
- Sum of all daily differences (Vita Mojo − Envelope)
- Positive total = net shortfall — cash register was short
- Negative total = net surplus — more cash collected than POS showed

**Step 4 — Actual Cash Available:**
- `Opening Balance + Cash Collected This Week`
- This is the physical cash the manager has in hand

**Step 5 — Wage Breakdown per Employee:**
- System reads each employee's hours logged for this week (from `employee_hours` table)
- For each employee:
  - Bank hours (PAYE): min(total_hours, `bank_weekly_hours_limit`, default 20) → paid by bank transfer, shown for reference
  - Cash hours: total_hours − bank_hours
  - Cash wage: cash_hours × `hourly_cash_rate`
  - Deliveries (if driver): count × `delivery_rate`
  - Total cash payout: cash_wage + delivery_wages

**Step 6 — Summary:**
- Total cash wages owed = sum of all employees' cash payouts
- **Post Office Draw** = max(0, total wages − actual cash available) — amount to draw from Post Office
- **Surplus carry forward** = max(0, actual cash available − total wages) — amount to carry to next week

3. Manager reviews the breakdown, confirms figures with physically available cash
4. Clicks **Confirm Payout**:
   - Enters the actual payment date
   - System writes a locked `cash_payouts` record + one `cash_payout_lines` record per employee
   - Payout status changes to "Confirmed" — record is now immutable
   - Surplus (if any) will appear as next week's opening balance

### 7.5 Managing Employee Schedules

1. Manager navigates to `/manager/employees`
2. Sees all employees assigned to their store
3. Clicks an employee → opens employee detail
4. Clicks **Schedule** tab
5. Sees a 7-day grid (Mon–Sun) showing the employee's recurring weekly pattern:
   - Is working: yes/no
   - Start time, end time
6. Clicks **Edit Schedule** → opens **Schedule Edit Modal**
7. For each weekday: toggles "Working" on/off, sets start and end time
8. Saves → updates `employee_schedules` table
9. This template is used when auto-generating future rotas

### 7.6 Managing the Rota (Manager)

1. Manager navigates to `/manager/rota`
2. Sees the same week-view grid as admin but scoped to their store
3. Can click any cell to edit a specific shift for a specific day
4. Shifts on future dates: no restrictions
5. Shifts on today: must enter a reason if shift has already started (same-day edit protection)
6. Shift changes are immediately visible to the employee in their portal

### 7.7 Resolving Alerts

1. Manager navigates to `/manager/alerts`
2. Sees all unresolved alerts for their store only
3. Common alerts they handle:
   - **Late clock-in:** Employee clocked in 15+ min late — manager notes the reason (traffic, etc.)
   - **Unexpected absence:** Scheduled employee never clocked in — manager investigates
   - **Missing daily entry:** Today's cash entry was not submitted by 23:00 — manager submits it
   - **Wages not confirmed:** Saturday payout not confirmed by 18:00 — manager confirms it
4. Clicks **Resolve** on any alert, types a brief note, saves
5. Alert is marked resolved with timestamp and manager's name

### 7.8 Viewing Analytics

1. Manager navigates to `/manager/analytics`
2. Can switch between **Weekly** and **Monthly** view
3. **Weekly view:**
   - Bar chart: scheduled vs actual hours per employee
   - Wage breakdown: cash wages vs delivery wages
   - Daily cash entries: Vita Mojo vs envelope trend line
   - Alert summary for the week
4. **Monthly view:**
   - Monthly total wages, total hours, average daily sales
   - Week-by-week comparison bars
   - Delivery counts per driver

---

## 8. User Flows — Employee

Employees have the simplest and most focused portal — it's designed to be used on a phone.

### 8.1 Employee Login

1. Employee opens the app on their phone (browser — no native app install needed, but designed as a PWA-friendly web app)
2. Navigates to `/employee/login` (or they may have this bookmarked)
3. Enters username and password (provided by admin/manager)
4. If first login: redirected to `/change-password`
5. On successful login: lands on `/employee/attendance` (the clock-in screen)

### 8.2 Clocking In

This is the primary daily interaction for most employees.

1. Employee opens `/employee/attendance`
2. Screen shows:
   - Today's scheduled shift (start time, end time, store)
   - Current time
   - "Clock In" button (disabled if already clocked in)
3. Employee taps **Clock In**
4. Browser requests GPS location permission
5. If permission denied → clock-in blocked with message "Location access is required to clock in"
6. If permission granted:
   - Browser sends `latitude`, `longitude`, and `accuracy` (in metres) to server action `clockIn()`
   - Server applies Haversine formula:
     - Distance from employee GPS to store centre coordinates
     - Effective tolerance = store geofence radius (250m) + min(GPS accuracy, 100m)
     - If distance > effective tolerance → **Rejected:** "You appear to be outside the store. Please try again when on-site."
     - If within tolerance → **Accepted**
   - Clock event saved with GPS coordinates and timestamp (`clock_in_at`)
   - `scanForAlertsBackground()` fires in background to check for late-clock-in
7. Screen updates:
   - Shows "Clocked in at HH:MM"
   - Shows live elapsed time since clock-in
   - "Clock In" button replaced by "Clock Out" button

### 8.3 Clocking Out

1. Employee opens `/employee/attendance` at end of shift
2. Screen shows:
   - Clock-in time
   - Elapsed time (live)
   - If employee is a driver: a number input for delivery count ("How many deliveries did you do today?")
3. Employee enters delivery count (0 if not applicable)
4. Taps **Clock Out**
5. **No GPS check on clock-out** — once you're in, you're in (reduces friction)
6. `clockOut(deliveries_count)` server action called:
   - Updates `clock_out_at` timestamp on the existing clock event
   - Saves `deliveries_count`
   - Runs background alert scan (checks early clock-out, scheduled vs. actual)
7. Screen updates:
   - Shows "Clocked out at HH:MM"
   - Shows total hours worked today

### 8.4 Viewing the Schedule

1. Employee navigates to `/employee/shifts`
2. Sees a weekly view of their scheduled shifts
3. For each day:
   - Shift start and end time
   - Store name
   - Manager notes (if any were added to the shift)
   - Day Off indicator if scheduled as a day off
4. Can navigate forward/backward by week using arrow buttons
5. Read-only — employees cannot edit their own schedule

### 8.5 Viewing Own Profile

1. Employee navigates to `/employee/profile`
2. Sees their own profile in read-mostly view:
   - Name, phone, email (if any), position, store
   - Date of birth (read-only — only admin can change)
   - Bank details: bank name, account name, account number, sort code (for PAYE/bank transfers — employee can update)
   - Employment dates (read-only)
3. Clicks **Edit Profile** to update editable fields:
   - Phone
   - Bank details (account name, bank name, sort code, account number)
   - Some personal fields
4. Saves → calls `updateSelfProfile()` server action which only updates the employee's own record (enforced by RLS — they cannot pass a different employee ID)

### 8.6 Changing Password

1. Employee navigates to `/employee/settings`
2. Sees a **Change Password** card
3. Enters current password, new password, confirm new password
4. Saves → calls Supabase `updateUser()` — password updated in auth
5. Confirmation shown; can log out and log back in with new password

---

## 9. Database Architecture

All tables have Row Level Security (RLS) enabled. The schema is idempotent — running `schema.sql` on an existing database is safe (uses `CREATE TABLE IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS`, etc.).

### 9.1 Core Tables

#### `allowed_users` — Login Whitelist

The single source of truth for who can log in and what role they have.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key (from Supabase Auth user ID) |
| email | text (unique) | Real email (admin) or synthetic email (staff) |
| name | text | Display name |
| role | text | `admin` / `manager` / `employee` |
| store_id | uuid (FK → stores) | Which store (manager/employee only) |
| username | text | Login username for staff portals |
| temp_password | text | Last generated temp password (plaintext, for re-sharing) |
| must_change_password | boolean | Forced change on next login |
| employee_id | uuid (FK → employees) | Links to employee record (employee role only) |
| created_at | timestamptz | When added |

**RLS:** Only admins can read/write all rows. Managers/employees can read their own row.

#### `stores` — Physical Locations

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| code | text (unique) | `stevenage` / `hitchin` |
| name | text | Display name |
| latitude | float | Store GPS latitude |
| longitude | float | Store GPS longitude |
| geofence_radius_m | integer | Clock-in radius in metres (default 250) |

#### `employees` — Workforce Master

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| name | text | Full name |
| phone | text | Contact phone |
| is_active | boolean | Active flag |
| joined_date | date | Date added to system |
| notes | text | Internal notes |
| hourly_rate | numeric | Base hourly rate (£) |
| hourly_ni_rate | numeric | Bank/NI hourly rate (£) |
| hourly_cash_rate | numeric | Cash hourly rate (£) |
| delivery_rate | numeric | Per-delivery rate in £ |
| bank_weekly_hours_limit | integer | Hours threshold for NI (default 20) |
| date_of_birth | date | For min-wage compliance check |
| gender | text | For HR records |
| position | text | `Kitchen` / `Counter` / `Driver` / `Other` |
| employment_start_date | date | Actual start of employment |
| email | text | Personal email (optional) |
| auth_user_id | uuid | Links to Supabase Auth user |
| bank_account_name | text | For PAYE bank transfers |
| bank_name | text | |
| account_number | text | |
| sort_code | text | |
| store_id | uuid (FK → stores) | Assigned store |
| employment_status | text | `active` / `inactive` / `left` |

#### `employee_hours` — Manual Weekly Hours

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| employee_id | uuid | FK → employees |
| week_start_date | date | Monday of the week |
| total_hours_worked | numeric | Total hours |
| hourly_rate_snapshot | numeric | Rate at time of logging (immutable history) |
| notes | text | Optional notes |
| logged_by | uuid | Who logged it |
| created_at | timestamptz | |

**Unique key:** (employee_id, week_start_date) — one entry per employee per week.

**Computed view `employee_hours_computed`:**
- `bank_hours` = min(total_hours_worked, bank_weekly_hours_limit)
- `cash_hours` = total_hours_worked − bank_hours
- `cash_amount_due` = cash_hours × hourly_cash_rate_snapshot

#### `rota_shifts` — Published Shift Schedule

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| employee_id | uuid | FK → employees |
| store_id | uuid | FK → stores |
| shift_date | date | Specific calendar date |
| start_time | time | Shift start (nullable if day off) |
| end_time | time | Shift end (nullable if day off) |
| is_day_off | boolean | Marks as a day off (no work) |
| scheduled_hours | numeric | Computed: end − start |
| manager_notes | text | Notes visible to employee |
| same_day_edit_reason | text | Required if editing today's shift after start |
| created_by / updated_by | uuid | Audit |
| created_at / updated_at | timestamptz | |

**Unique key:** (employee_id, shift_date) — one shift row per employee per day.

#### `employee_schedules` — Recurring Weekly Template

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| employee_id | uuid | FK → employees |
| weekday | integer | 0 = Monday … 6 = Sunday |
| is_working | boolean | Working on this day |
| start_time | time | Default start |
| end_time | time | Default end |
| created_by / updated_by | uuid | |
| created_at / updated_at | timestamptz | |

**Unique key:** (employee_id, weekday)

#### `clock_events` — Attendance Records

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| employee_id | uuid | FK → employees |
| shift_id | uuid | FK → rota_shifts (nullable) |
| store_id | uuid | FK → stores |
| event_date | date | Date of clock event |
| clock_in_at | timestamptz | Exact timestamp of clock-in |
| clock_out_at | timestamptz | Exact timestamp of clock-out (null if still working) |
| clock_in_lat | float | GPS latitude at clock-in |
| clock_in_lng | float | GPS longitude at clock-in |
| clock_out_lat | float | GPS latitude at clock-out |
| clock_out_lng | float | GPS longitude at clock-out |
| deliveries_count | integer | Number of deliveries logged on clock-out |
| created_at | timestamptz | |

**Unique key:** (employee_id, event_date) — one clock record per employee per day.

#### `weekly_deliveries` — Delivery Performance Tracking

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| driver_id | uuid | FK → employees |
| store_id | uuid | FK → stores |
| week_start_date | date | Monday of week |
| manager_avg_4wk | numeric | Manager's manually entered 4-week avg (for comparison) |
| vita_mojo_count | integer | Vita Mojo delivery count (cross-check) |
| notes | text | |
| reason | text | If spike: explanation |
| created_at / updated_at | timestamptz | |

**Unique key:** (driver_id, week_start_date)

#### `alerts` — System Alerts

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| alert_type | text | See §12 for full list |
| severity | text | `info` / `warning` / `critical` |
| store_id | uuid | Which store this relates to |
| employee_id | uuid | Which employee (nullable) |
| shift_id | uuid | Which shift (nullable) |
| title | text | Short human-readable title |
| message | text | Detailed description |
| payload | jsonb | Extra context data (hours, rates, counts) |
| resolved | boolean | Has it been resolved? |
| resolved_at | timestamptz | |
| resolved_by | uuid | |
| resolution_note | text | Manager's note on resolution |
| created_at | timestamptz | |

#### `audit_log` — Immutable Change History

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| actor_id | uuid | Who made the change |
| actor_email | text | Their email (denormalized for readability) |
| action | text | What action (create_employee, update_shift, etc.) |
| entity | text | What type of record |
| entity_id | uuid | The specific record |
| changes | jsonb | `{ field: { old: x, new: y } }` diff |
| created_at | timestamptz | |

#### `app_settings` — Global Configuration

| Column | Type | Description |
|---|---|---|
| key | text (PK) | Setting group name |
| value | jsonb | Setting values (object) |
| updated_at | timestamptz | |
| updated_by | uuid | Who last changed it |

Four rows exist: `alert_thresholds`, `min_wage_bands`, `email_alerts`, `cash_flow`

### 9.2 Cash Flow Tables

#### `daily_cash_entries` — Daily Reconciliation

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| store_id | uuid | FK → stores |
| entry_date | date | Calendar date |
| vita_mojo_sales | numeric | POS reported sales (£) |
| envelope_amount | numeric | Physical cash collected (£) |
| difference | numeric (generated) | `vita_mojo_sales − envelope_amount`; positive = shortfall |
| reason | text | Mandatory if difference ≠ 0 |
| is_late | boolean | Submitted after 23:00 |
| submitted_by | uuid | Auth user who submitted |
| submitted_by_name | text | Denormalized name |
| submitted_by_email | text | Denormalized email |
| edited_by_name | text | Last editor name |
| edited_at | timestamptz | Last edit timestamp |
| created_at / updated_at | timestamptz | |

**Unique key:** (store_id, entry_date)

#### `cash_payouts` — Weekly Payout Header

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| store_id | uuid | FK → stores |
| week_start_date | date | Monday of the week |
| payment_date | date | Actual Saturday payment date |
| status | text | `draft` / `confirmed` |
| opening_balance | numeric | Carry-forward from prior week |
| cash_collected | numeric | Sum of week's envelope amounts |
| logged_differences | numeric | Sum of week's discrepancies |
| actual_cash_available | numeric | opening + cash_collected |
| total_cash_wages | numeric | Sum of employee cash wages |
| total_delivery_wages | numeric | Sum of driver delivery wages |
| grand_total_wages | numeric | total_cash + total_delivery |
| post_office_draw | numeric | Shortfall to draw from PO |
| surplus_carry_forward | numeric | Excess to carry to next week |
| locked | boolean | True once confirmed (immutable) |
| confirmed_by | uuid | Who confirmed |
| confirmed_by_name | text | Denormalized name |
| confirmed_at | timestamptz | When confirmed |
| created_at / updated_at | timestamptz | |

**Unique key:** (store_id, week_start_date)

#### `cash_payout_lines` — Per-Employee Payout Lines

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| payout_id | uuid | FK → cash_payouts |
| employee_id | uuid | FK → employees |
| employee_name | text | Denormalized (snapshot) |
| role | text | Position at time of payout |
| cash_hours | numeric | Cash-eligible hours |
| cash_rate | numeric | Snapshot of cash rate at payout time |
| cash_wage | numeric | cash_hours × cash_rate |
| deliveries_count | integer | Total deliveries this week |
| delivery_rate | numeric | Snapshot of delivery rate |
| delivery_wages | numeric | deliveries × rate |
| total_payment | numeric | cash_wage + delivery_wages |
| is_paid | boolean | Marked when physically paid |
| paid_at | timestamptz | |
| paid_by_name | text | Who paid them |
| created_at / updated_at | timestamptz | |

**Unique key:** (payout_id, employee_id)

---

## 10. Authentication & Security Model

### 10.1 Three Separate Login Portals

| Portal | URL | Who |
|---|---|---|
| Admin | `/login` | Business owner |
| Manager | `/manager/login` | Store managers |
| Employee | `/employee/login` | Kitchen/counter staff |

All portals use the same Supabase Auth backend, but staff have synthetic email addresses.

### 10.2 Credential System for Staff

Staff (managers and employees) do not have real email addresses in the system. Instead:

- **Username:** Auto-generated from their name (e.g., "Pavan Kumar" → `pavan.kumar`)
- **Synthetic email:** `{username}@staff.peckers-app.co.uk` (used internally for Supabase Auth, never shown to the user)
- **Password:** Randomly generated 8-character alphanumeric temporary password on account creation
- **Forced change:** `must_change_password = true` on creation; cleared only after they set their own password

This means:
- Staff never need to know their "email" — they just enter username + password
- The login form shows "Username" not "Email" on the manager/employee portals
- Password reset is done by admin/manager generating a new temp password (not via email)

### 10.3 Middleware (Request Pipeline)

Every request passes through `middleware.ts` before reaching any page or server action:

1. **Session check:** Calls `supabase.auth.getUser()` — validates JWT
2. **Whitelist check:** Queries `allowed_users` to confirm this user is still allowed (handles the case of an admin removing someone mid-session)
3. **Role check:** Gets their role from `allowed_users.role`
4. **Header injection:** Encodes their identity (user_id, email, role, store_id) into a base64 JSON string in the `x-pk-allowed` header — this is a server-only header, stripped before any response
5. **Portal enforcement:**
   - If `role = admin` and they're on `/manager/*` or `/employee/*` → redirect to admin portal
   - If `role = manager` and they're on admin pages → redirect to `/manager/live`
   - If `role = employee` and they're not on `/employee/*` → redirect to `/employee/attendance`
6. **Password change gate:** If `must_change_password = true` and not on `/change-password` → redirect there

### 10.4 Row Level Security (RLS)

All database access is gated by Postgres RLS policies. Even if someone has a valid session JWT, they cannot read data they're not authorized for.

**Key RLS helper functions:**
- `current_user_role()` — returns the role of the currently authenticated user
- `is_staff()` — returns true if role is manager or employee
- `current_employee_id()` — returns the employee_id linked to the current user (employees only)
- `current_user_store_id()` — returns the store_id of the current user (managers/employees)
- `can_access_store(store_id)` — returns true if admin, or if the store_id matches user's store

**Example policies:**
- `employees` table: admin can see all rows; manager can see rows where `store_id = current_user_store_id()`; employee can see only their own row
- `clock_events` table: employees can INSERT/UPDATE only their own row; managers can see all events for their store
- `rota_shifts` table: everyone can read shifts for their scope; only manager/admin can insert/update
- `audit_log` table: admin can read all; no other role can read it; no one can update or delete rows

### 10.5 Security Architecture Notes

- **Auth headers are optimization only:** Server actions always re-validate the user's identity by calling `getSessionUser()` which hits the database directly. Headers are used by server components for fast rendering but never trusted for authorization decisions.
- **Service-role client:** The `SUPABASE_SERVICE_ROLE_KEY` is used only in `lib/supabase-admin.ts`, only accessible in server-side code (never exposed to the browser), and only used for account provisioning operations (creating auth users, bypassing RLS to insert whitelist rows).
- **Temp passwords stored in plaintext:** `allowed_users.temp_password` stores the last generated password in plaintext so admin can re-share it if needed. This is a deliberate design choice for operational simplicity; the value is cleared once the user changes their password.

---

## 11. Business Logic Deep Dive

### 11.1 Wage Calculation (`lib/cash-flow.ts`)

The wage calculation is intentionally a **pure function library** — no database imports, no side effects. The same functions run both client-side (for the live preview in Pre-Payment View) and server-side (when persisting the confirmed payout).

**Bank vs. Cash Split:**

Every employee has a `bank_weekly_hours_limit` (default 20 hours). Of their total weekly hours:
- First N hours (up to the limit) are "bank" hours — paid via bank transfer, subject to NI/PAYE
- Any hours beyond N are "cash" hours — paid in cash, at the `hourly_cash_rate`

Example: Employee works 32 hours, limit = 20, cash rate = £9.50
- Bank hours = 20 (employer pays these via bank transfer, handles tax)
- Cash hours = 12
- Cash wage = 12 × £9.50 = £114.00

**Rate Snapshotting:**

When hours are logged (via `logEmployeeHours()`), the current `hourly_rate`, `hourly_ni_rate`, and `hourly_cash_rate` are snapshotted into the `employee_hours` row. This means:
- Raising an employee's rate mid-year does not retroactively change past pay records
- Historical payouts are immutable and auditable

**Delivery Wages:**

Only employees with `position = "Driver"` receive delivery wages.
- Delivery count comes from `clock_events.deliveries_count` (employee self-reported on clock-out) or from `weekly_deliveries` manual entry by manager
- Delivery wage = count × `employee.delivery_rate` (snapshotted at payout time)

### 11.2 Saturday Payout Calculation

```
opening_balance  = confirmed surplus from last week (if carry-forward enabled, else 0)
cash_collected   = sum(daily_cash_entries.envelope_amount for Mon–Sat this week)
actual_available = opening_balance + cash_collected

total_cash_wages     = sum(cash_payout_lines.cash_wage)
total_delivery_wages = sum(cash_payout_lines.delivery_wages)
grand_total          = total_cash_wages + total_delivery_wages

post_office_draw    = max(0, grand_total − actual_available)
surplus_carry_fwd   = max(0, actual_available − grand_total)
```

The `logged_differences` field (sum of daily discrepancies) is stored for reporting but does not affect the payout math — the payout uses actual `envelope_amount` (physical cash), not `vita_mojo_sales`.

### 11.3 Geofencing (`lib/utils.ts`)

Uses the **Haversine formula** to calculate great-circle distance between two GPS coordinates.

**Clock-in validation:**
```
distance = haversine(employee_lat, employee_lng, store_lat, store_lng)
tolerance = store.geofence_radius_m + min(gps_accuracy, 100)  // cap accuracy at 100m
if distance > tolerance → reject clock-in
```

- The 100m accuracy cap prevents an employee with a poor GPS signal from exploiting a claimed ±300m accuracy to clock in from anywhere.
- Enforced on both client side (for instant feedback) and server side (authoritative check in the server action).

### 11.4 Minimum Wage Compliance (`lib/compliance.ts`)

Runs whenever an employee's hourly rate is saved or updated.

1. Get employee's age from `date_of_birth` using `ageFromDOB()`
2. Look up the correct minimum wage band from `app_settings.min_wage_bands`
3. Compare `employee.hourly_ni_rate` (the PAYE/bank rate) against the band floor
4. If below floor: create a `min_wage_violation` alert (severity: `warning`)
5. Does not block the save — it's advisory only

### 11.5 Week Boundaries

The system uses **Monday as the start of the week** throughout (ISO 8601 convention). The utility function `getWeekStart(date)` always returns the Monday of the week containing that date.

All week-based records (`employee_hours`, `rota_shifts` date ranges, `cash_payouts`, `weekly_deliveries`) reference weeks by their Monday date in YYYY-MM-DD format.

---

## 12. Alert System

### 12.1 Alert Types

| Alert Type | Trigger Condition | Severity |
|---|---|---|
| `wage_variance` | This week's scheduled hours > 4-week average × (1 + threshold%) | warning |
| `min_wage_violation` | Employee's hourly NI rate < legal minimum for their age | warning |
| `late_clock_in` | Employee clocked in > 15 min after scheduled start | info |
| `unexpected_absence` | Scheduled employee not clocked in > 60 min after shift start | critical |
| `early_clock_out` | Employee clocked out > 30 min before scheduled end | warning |
| `scheduled_vs_actual` | Actual worked hours vs. scheduled ≠ within 25% | warning |
| `delivery_payout_high` | This week's deliveries > 4-week average × 1.5 | warning |
| `delivery_unassigned` | Driver has deliveries logged but no delivery rate set | warning |
| `missing_daily_entry` | Store has no daily cash entry by 23:00 | critical |
| `unresolved_discrepancy` | Daily entry has non-zero difference with no resolution | warning |
| `post_office_draw` | Payout requires Post Office draw (cash shortfall) | info |
| `negative_cash_balance` | Cash available goes negative after payout | critical |
| `wages_not_confirmed` | Saturday payout still in draft after 18:00 | critical |
| `unconfirmed_payment` | Individual employee line item not marked paid | info |

### 12.2 Alert Lifecycle

1. **Created:** Background scanner (`scanForAlertsBackground()`) runs after clock events, shift edits, payout updates
2. **Deduplication:** System checks for an existing unresolved alert with the same `(alert_type, employee_id, shift_id)` combination — if found, does not create a duplicate
3. **Visible:** Appears on `/alerts` (admin) or `/manager/alerts` (manager) with severity badge
4. **Resolved:** Manager clicks Resolve, enters note — `resolved = true`, `resolved_at`, `resolved_by`, `resolution_note` set
5. **History preserved:** Resolved alerts are never deleted — visible in history

### 12.3 Email Notifications

If `app_settings.email_alerts.enabled = true` and recipients are configured:
- When new alerts are created, a digest email is sent via **Resend** API
- Email includes alert title, message, severity, and a link to the alerts page
- No email = silent operation; the app still functions fully without email configured

---

## 13. Project Structure (File Map)

```
peckers-cashflow/
├── app/
│   ├── (auth)/                          # Public — no auth required
│   │   ├── login/page.tsx               # Admin login page
│   │   ├── manager/login/page.tsx       # Manager login page
│   │   ├── employee/login/page.tsx      # Employee login page
│   │   ├── change-password/page.tsx     # Forced password change
│   │   └── access-denied/page.tsx      # Access denied landing
│   ├── (protected)/                     # Admin portal
│   │   ├── layout.tsx                   # Admin sidebar + nav layout
│   │   ├── dashboard/page.tsx           # Daily summary + quick entry
│   │   ├── cash-flow/
│   │   │   ├── page.tsx                 # Cash flow overview (both stores)
│   │   │   ├── [storeId]/
│   │   │   │   ├── daily/page.tsx       # Daily entries per store
│   │   │   │   ├── payout/page.tsx      # Pre-payment view per store
│   │   │   │   └── history/page.tsx     # Payout history per store
│   │   ├── employees/page.tsx           # Employee list + CRUD
│   │   ├── rota/page.tsx                # Week-view rota grid
│   │   ├── live/page.tsx                # Real-time staffing dashboard
│   │   ├── analytics/page.tsx           # Charts & trends
│   │   ├── alerts/page.tsx              # Alert list + resolution
│   │   ├── managers/page.tsx            # Manager account management
│   │   └── settings/page.tsx            # App config + whitelist + audit
│   ├── manager/                         # Manager portal
│   │   ├── layout.tsx                   # Manager sidebar + nav layout
│   │   ├── live/page.tsx                # Live dashboard (store-scoped)
│   │   ├── cash-flow/
│   │   │   ├── page.tsx                 # Weekly cash flow overview
│   │   │   ├── daily/page.tsx           # Daily cash entry form
│   │   │   └── payout/page.tsx          # Pre-payment view + confirm
│   │   ├── employees/page.tsx           # Store employee management
│   │   ├── rota/page.tsx                # Store rota editing
│   │   ├── analytics/page.tsx           # Store analytics
│   │   ├── alerts/page.tsx              # Store alerts
│   │   └── settings/page.tsx            # Settings (read-only view)
│   ├── employee/                        # Employee portal
│   │   ├── layout.tsx                   # Employee mobile layout
│   │   ├── attendance/page.tsx          # Clock in/out app
│   │   ├── shifts/page.tsx              # View own schedule
│   │   ├── profile/page.tsx             # View + update own profile
│   │   └── settings/page.tsx            # Change password
│   ├── actions/                         # Server actions (all mutations)
│   │   ├── auth.ts                      # Sign-out
│   │   ├── accounts.ts                  # Create/reset manager+employee accounts
│   │   ├── employees.ts                 # Employee CRUD + hours logging
│   │   ├── clock.ts                     # Clock in/out + geofence validation
│   │   ├── rota.ts                      # Shift CRUD + rota generation
│   │   ├── cash-flow.ts                 # Daily cash entry upsert
│   │   ├── payouts.ts                   # Payout preview + confirm
│   │   ├── alerts.ts                    # Alert scanner + resolution
│   │   ├── audit.ts                     # Audit log writes
│   │   ├── schedule.ts                  # Weekly schedule template CRUD
│   │   ├── settings.ts                  # App settings updates
│   │   ├── stores.ts                    # Store CRUD (admin)
│   │   └── self.ts                      # Employee self-profile update
│   ├── layout.tsx                       # Root layout (ThemeProvider)
│   ├── page.tsx                         # Root redirect → portal home
│   └── globals.css                      # Tailwind + CSS variables
├── components/
│   ├── ui/                              # Base UI components
│   │   ├── Button.tsx                   # Button variants (primary/secondary/ghost/danger)
│   │   ├── Input.tsx                    # Form input
│   │   ├── Card.tsx                     # Card container
│   │   ├── Modal.tsx                    # Modal overlay
│   │   ├── Badge.tsx                    # Status badges
│   │   ├── Toast.tsx                    # Toast notifications
│   │   ├── Skeleton.tsx                 # Loading skeleton
│   │   ├── EmptyState.tsx               # Empty list placeholder
│   │   └── icons.tsx                    # SVG icon components
│   ├── layout/                          # Navigation & structural components
│   │   ├── Sidebar.tsx                  # Desktop sidebar navigation
│   │   ├── BottomNav.tsx                # Mobile bottom navigation
│   │   ├── TopBar.tsx                   # Mobile top header
│   │   ├── TopProgressBar.tsx           # Page load progress bar
│   │   ├── PageHeader.tsx               # Page title + description
│   │   ├── Logo.tsx                     # App logo
│   │   └── nav-config.tsx               # Nav items definitions per role
│   ├── cash-flow/                       # Cash flow feature components
│   │   ├── CashFlowDashboard.tsx        # Week summary (both stores)
│   │   ├── DailyCashView.tsx            # Daily entry form
│   │   ├── PayoutHistoryView.tsx        # Historical payouts list
│   │   └── PrePaymentView.tsx           # Saturday payout preview + confirm
│   ├── employees/                       # Employee management components
│   │   ├── EmployeesView.tsx            # Employee list/grid
│   │   ├── EmployeeCard.tsx             # Individual employee card
│   │   ├── AddEmployeeModal.tsx         # Add employee form
│   │   ├── EditEmployeeModal.tsx        # Edit employee form
│   │   ├── EmployeeProfileForm.tsx      # Shared profile form fields
│   │   ├── HoursTable.tsx               # Weekly hours history table
│   │   ├── LogHoursForm.tsx             # Log hours form
│   │   └── ScheduleEditModal.tsx        # Weekly schedule editor
│   ├── rota/                            # Scheduling components
│   │   ├── RotaView.tsx                 # Week-view grid
│   │   ├── ShiftEditModal.tsx           # Shift time editor
│   │   └── DeliveryEditModal.tsx        # Weekly delivery count editor
│   ├── live/
│   │   └── LiveDashboard.tsx            # Real-time staffing view
│   ├── crew/
│   │   └── CrewClockApp.tsx             # Employee clock-in/out UI
│   ├── analytics/
│   │   ├── AnalyticsView.tsx            # Container + toggle
│   │   ├── WeeklyView.tsx               # Weekly analytics charts
│   │   ├── MonthlyView.tsx              # Monthly analytics charts
│   │   ├── StatTile.tsx                 # KPI tile component
│   │   └── useChartColors.ts            # Chart colour hooks (theme-aware)
│   ├── alerts/
│   │   └── AlertsView.tsx               # Alert list + resolve UI
│   ├── settings/
│   │   ├── AllowedUsersAdmin.tsx        # Whitelist management
│   │   ├── CashFlowSettingsCard.tsx     # Cash flow policy settings
│   │   ├── AlertSettingsCard.tsx        # Alert threshold settings
│   │   ├── AppearanceCard.tsx           # Theme toggle
│   │   ├── AuditLogList.tsx             # Audit log viewer
│   │   └── StoresAdmin.tsx              # Store config (coordinates, radius)
│   ├── auth/
│   │   ├── LoginForm.tsx                # Login form (email+pass / username+pass)
│   │   ├── ForcedPasswordChange.tsx     # First-login password change form
│   │   └── AuthShell.tsx                # Auth page wrapper (logo, card)
│   ├── theme/
│   │   ├── ThemeProvider.tsx            # React context for light/dark
│   │   └── ThemeToggle.tsx              # Toggle button
│   ├── accounts/
│   │   └── CredentialsModal.tsx         # Shows generated username+password after creation
│   ├── managers/
│   │   └── ManagersView.tsx             # Manager accounts list + actions
│   └── employee/
│       ├── EmployeeSelfProfile.tsx      # Employee's own profile view/edit
│       └── ChangePasswordCard.tsx       # Password change form
├── lib/
│   ├── types.ts                         # All TypeScript types (tables + computed)
│   ├── utils.ts                         # Date, currency, week, CSV, Haversine helpers
│   ├── supabase.ts                      # Browser Supabase client (anon key)
│   ├── supabase-server.ts               # Server Supabase client + getSessionUser()
│   ├── supabase-admin.ts                # Service-role client (account provisioning)
│   ├── auth-headers.ts                  # Identity header encode/decode
│   ├── cash-flow.ts                     # Pure wage calculation functions
│   ├── cash-flow-data.ts                # Server-side data loaders (admin+manager shared)
│   ├── compliance.ts                    # Min-wage check + alert generation
│   ├── credentials.ts                   # Username + synthetic email generation
│   ├── settings.ts                      # App settings loading + defaults merge
│   └── email.ts                         # Resend alert digest sender
├── supabase/
│   └── schema.sql                       # Complete database schema (idempotent)
├── middleware.ts                        # Auth + whitelist + header injection
├── tailwind.config.ts                   # Tailwind config (dark theme, gold accent)
├── next.config.js                       # Next.js config
├── tsconfig.json                        # TypeScript config
├── package.json                         # Dependencies
└── README.md                            # Setup + deployment guide
```

---

## 14. Server Actions Reference

All mutations in the system go through Next.js Server Actions (TypeScript functions marked `"use server"`). There is no separate REST API layer.

### Authentication
| Action | File | What it does |
|---|---|---|
| `signOutAction()` | `actions/auth.ts` | Signs out current user, clears session, redirects to login |

### Account Provisioning
| Action | File | What it does |
|---|---|---|
| `createManagerAccount(name, store_id)` | `actions/accounts.ts` | Generates username+password, creates auth user + allowed_users row for a manager |
| `createEmployeeWithAccount(profile)` | `actions/accounts.ts` | Creates employee record + auth account in one step |
| `provisionEmployeeAccount(employee_id)` | `actions/accounts.ts` | Adds an account to an existing employee who doesn't have one yet |
| `resetEmployeePassword(employee_id)` | `actions/accounts.ts` | Generates new temp password, updates auth + stores temp_password |
| `resetManagerPassword(user_id)` | `actions/accounts.ts` | Same but for managers |
| `deleteAllowedUser(email)` | `actions/accounts.ts` | Removes user from whitelist (does not delete auth user) |

### Employee Management
| Action | File | What it does |
|---|---|---|
| `createEmployee(input)` | `actions/employees.ts` | Creates HR profile (no login). Writes audit log. |
| `updateEmployee(input)` | `actions/employees.ts` | Updates employee fields. Writes audit log. Runs compliance check if rate changed. |
| `archiveEmployee(id, archive)` | `actions/employees.ts` | Toggles `is_active` and `employment_status`. Writes audit log. |
| `logEmployeeHours(...)` | `actions/employees.ts` | Upserts weekly hours record with rate snapshots. |
| `updateEmployeeSchedule(emp_id, schedules[])` | `actions/schedule.ts` | Replaces employee's weekly schedule template. |

### Rota & Shifts
| Action | File | What it does |
|---|---|---|
| `upsertShift(input)` | `actions/rota.ts` | Create or update a specific shift for employee+date. Enforces same-day edit reason. Computes scheduled_hours. |
| `generateRota(store_id, date_from, weeks)` | `actions/rota.ts` | Auto-creates rota_shifts from employee_schedules templates (skips existing). |
| `deleteShift(shift_id)` | `actions/rota.ts` | Removes a specific shift. |

### Clock Events (Attendance)
| Action | File | What it does |
|---|---|---|
| `clockIn(lat, lng, accuracy)` | `actions/clock.ts` | Validates geofence, creates clock event, fires alert scanner. |
| `clockOut(deliveries_count)` | `actions/clock.ts` | Updates clock_out_at, saves deliveries, fires alert scanner. |
| `manualClockEntry(...)` | `actions/clock.ts` | Manager-override clock entry (bypasses geofence). |

### Cash Flow
| Action | File | What it does |
|---|---|---|
| `upsertDailyCashEntry(...)` | `actions/cash-flow.ts` | Create or update a daily reconciliation record. Validates reason requirement. Sets is_late flag. |
| `getPrePaymentSummary(store_id, week_start)` | `actions/payouts.ts` | Computes live Saturday payout preview (read-only; does not persist). |
| `confirmCashPayout(store_id, week_start, payment_date)` | `actions/payouts.ts` | Locks payout, writes cash_payouts + cash_payout_lines, fires alert scanner. |

### Alerts
| Action | File | What it does |
|---|---|---|
| `scanForAlertsBackground()` | `actions/alerts.ts` | Runs all alert checks for all stores + employees. Creates new alerts, deduplicates. Sends email if enabled. |
| `resolveAlert(id, note)` | `actions/alerts.ts` | Marks alert resolved with timestamp and resolution note. |

### Settings & Admin
| Action | File | What it does |
|---|---|---|
| `updateAppSettings(key, value)` | `actions/settings.ts` | Updates one settings group (alert_thresholds / min_wage_bands / email_alerts / cash_flow). |
| `addAllowedUser(email, name, role, store_id)` | `actions/settings.ts` | Adds a new row to allowed_users whitelist. |
| `updateStore(id, fields)` | `actions/stores.ts` | Updates store coordinates, name, or geofence radius. |

### Self-Service
| Action | File | What it does |
|---|---|---|
| `updateSelfProfile(fields)` | `actions/self.ts` | Employee updates their own profile (RLS enforces they can only update their own row). |

---

## 15. Configuration & Settings

All settings are stored in the `app_settings` table and loaded via `lib/settings.ts` which merges DB values over hardcoded defaults (so the app always works, even with an empty settings table).

### 15.1 Alert Thresholds

| Setting | Default | Effect |
|---|---|---|
| `wage_variance_pct` | 20% | Scheduled hours vs. 4-week avg — alert if > 20% deviation |
| `delivery_spike_multiplier` | 1.5× | Alert if week's deliveries > rolling avg × 1.5 |
| `late_clock_in_min` | 15 min | Alert if clock-in > 15 min after scheduled start |
| `absence_min` | 60 min | Alert if scheduled employee not clocked in > 60 min after start |
| `early_clock_out_min` | 30 min | Alert if clock-out > 30 min before scheduled end |
| `scheduled_vs_actual_pct` | 25% | Alert if actual hours vs. scheduled ≠ within 25% |

### 15.2 Minimum Wage Bands (April 2025)

| Band | Rate |
|---|---|
| National Living Wage (21+) | £12.21/hr |
| Ages 18–20 | £10.00/hr |
| Under 18 | £7.55/hr |
| Enabled | true (can disable compliance checks) |

### 15.3 Cash Flow Policy

| Setting | Default | Effect |
|---|---|---|
| `carry_forward_surplus` | true | Confirmed surplus rolls to next week's opening balance |
| `missing_entry_hour` | 23 | Fires "missing daily entry" alert after 23:00 if no entry submitted |
| `wages_confirm_hour` | 18 | Fires "wages not confirmed" alert on Saturday after 18:00 if payout is still draft |

### 15.4 Email Alerts

| Setting | Default | Effect |
|---|---|---|
| `enabled` | false | Master on/off for email digests |
| `recipients` | [] | List of email addresses to receive alert digests |

---

## 16. Data Flows End-to-End

### 16.1 Employee's First Day at Work

```
Admin provisions employee account
  → Employee receives username + temp password
  → Employee logs in at /employee/login
  → Forced password change → sets own password
  → Lands on /employee/attendance

[Morning of first shift]
Employee opens /employee/attendance
  → Sees today's scheduled shift (set by manager in /manager/rota)
  → Taps Clock In
  → Browser requests GPS
  → Client sends (lat, lng, accuracy) to clockIn() server action
  → Server computes Haversine distance to store
  → Within geofence → clock_events row created (clock_in_at = now())
  → Background: scanForAlertsBackground() checks for late clock-in
  → UI shows "Clocked in at 09:02"

[End of shift]
Employee taps Clock Out
  → If driver: enters deliveries_count
  → clockOut(deliveries_count) server action called
  → clock_events row updated: clock_out_at = now(), deliveries_count saved
  → Background: alert scan checks early clock-out, scheduled vs actual
  → UI shows "Clocked out at 17:15 — 8h 13m worked"
```

### 16.2 Manager's Daily Cash Routine

```
[End of each day, Mon–Sat]
Manager opens /manager/cash-flow
  → Sees today's entry row (empty if not yet entered)
  → Opens entry form
  → Types Vita Mojo sales figure from POS report
  → Types envelope amount (counted physical cash)
  → If different: types a reason
  → Submits → upsertDailyCashEntry() called
  → daily_cash_entries row created/updated
  → If submitted after 23:00: is_late = true
  → If difference > 0.01 and no reason: error (validation blocks save)
  → Manager sees entry row now shows figures + their name + timestamp
```

### 16.3 Saturday Wage Payout

```
[Saturday morning]
Manager opens /manager/cash-flow → Payout tab
  → System calls getPrePaymentSummary(store_id, week_start)
  → Queries: daily_cash_entries for this week → sums envelope amounts
  → Queries: employee_hours for this week → calculates each employee's cash wages
  → Queries: clock_events → sums deliveries per driver
  → Queries: last week's confirmed payout → gets opening balance
  → Returns: live preview object {opening, collected, available, wages_by_employee, PO_draw, surplus}
  → UI renders PrePaymentView with all figures

Manager reviews:
  → Checks each employee's cash wage matches expectation
  → Checks PO draw figure (if any)
  → If correct: clicks Confirm Payout
  → Enters payment date
  → confirmCashPayout() server action called:
    → Writes cash_payouts row (locked = true, status = confirmed)
    → Writes cash_payout_lines rows (one per employee, with rate snapshots)
    → Surplus stored in cash_payouts.surplus_carry_forward
    → Next week's getPrePaymentSummary() will pick this up as opening_balance
  → Alert scan: creates "wages not confirmed" alert if Saturday 18:00 passes with status=draft (prevented by this confirm)
```

### 16.4 Alert Flow

```
Any trigger event (clock-in, shift edit, payout confirm):
  → Server action completes its main work
  → Calls scanForAlertsBackground()
  → Scanner checks all open conditions for relevant stores/employees
  → For each condition met:
    → Check if identical unresolved alert already exists (dedup)
    → If no duplicate: INSERT into alerts table
    → If email enabled: send digest via Resend
  → Manager sees alert on /manager/alerts (unresolved count badge in nav)
  → Manager resolves: enters note → alert.resolved = true
  → Resolved alerts still visible in history (never deleted)
```

---

## 17. Deployment Setup

### Prerequisites
1. A [Supabase](https://supabase.com) project (free tier is fine for testing)
2. A [Vercel](https://vercel.com) account for hosting
3. Optional: A [Resend](https://resend.com) account for email alerts

### Step 1: Supabase Setup

1. Create a new Supabase project
2. Navigate to **SQL Editor**
3. Open `supabase/schema.sql` from this repo and run it entirely — this creates all tables, views, functions, and RLS policies
4. Navigate to **Authentication → Providers** → ensure **Email** provider is enabled
5. Navigate to **Authentication → Settings** → disable "Allow new users to sign up" (only whitelisted users should be able to log in)
6. Navigate to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Create First Admin User

In Supabase dashboard → **Authentication → Users**:
1. Click "Add user" → enter your real email address and a password → click "Auto Confirm"
2. Note the user's UUID

In **SQL Editor**, run:
```sql
INSERT INTO public.allowed_users (id, email, name, role)
VALUES ('[your-auth-user-uuid]', 'youremail@example.com', 'Admin Name', 'admin');
```

### Step 3: Environment Variables

Create a `.env.local` file (locally) or set environment variables in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...

# Optional — for email alerts
RESEND_API_KEY=re_xxxx
ALERT_EMAIL_FROM=alerts@yourdomain.com
```

### Step 4: Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo in Vercel
3. Add the environment variables from Step 3 in Vercel's project settings
4. Deploy

### Step 5: First Login

1. Navigate to your Vercel deployment URL (or `localhost:3000` in development)
2. Go to `/login` (admin portal)
3. Enter the email and password you created in Step 2
4. You should land on `/dashboard`
5. Navigate to `/settings` to configure alert thresholds, minimum wage bands, and store details
6. Navigate to `/managers` to create your first store manager account

### Development

```bash
npm install
npm run dev
# App runs at http://localhost:3000
```

---

## Appendix — Key Terminology

| Term | Meaning |
|---|---|
| Rota | The published shift schedule for specific dates |
| Schedule template | The recurring weekly pattern (Mon-Sun) used to auto-generate rotas |
| Bank hours / NI hours | Hours paid via bank transfer, subject to National Insurance (first N hours per week, default 20) |
| Cash hours | Hours beyond the bank threshold, paid in physical cash |
| Envelope amount | Physical cash collected at end of day, put into an envelope |
| Vita Mojo | The point-of-sale system used at Peckers; reports daily sales figures |
| Opening balance | Cash surplus carried forward from the previous confirmed payout |
| Post Office draw | The amount the manager needs to draw from the Post Office to cover wages when cash-in-hand < wages owed |
| Carry-forward | Policy to roll this week's surplus into next week's opening balance |
| Temp password | Auto-generated first-login password; stored in plaintext so admin can re-share if needed |
| Geofence | GPS-enforced location boundary for clock-in; employees must be within the radius of the store |
| NLW | National Living Wage (UK minimum wage for workers aged 21+) |
| NMW | National Minimum Wage (UK — rates for workers under 21) |
| Payout confirmed | Saturday wage payout is locked (immutable) and marked paid |
| RLS | Row Level Security — Postgres feature that enforces per-row access control at the database level |
