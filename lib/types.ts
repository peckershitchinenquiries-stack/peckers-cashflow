export type StoreCode = "stevenage" | "hitchin";

export type Store = {
  id: string;
  code: StoreCode;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  created_at: string;
};

export type AllowedUserRole = "admin" | "manager" | "employee";

export type AllowedUser = {
  id: string;
  email: string;
  name: string | null;
  role: AllowedUserRole;
  store_id: string | null;
  username: string | null;
  temp_password: string | null;
  must_change_password: boolean;
  employee_id: string | null;
  created_at: string;
};

/** Which portal a role lands in. */
export type Portal = "admin" | "manager" | "employee";

/** Home route for each role's portal. */
export const PORTAL_HOME: Record<AllowedUserRole, string> = {
  admin: "/dashboard",
  manager: "/manager/live",
  employee: "/employee/attendance",
};

/** The login page for each portal. */
export const PORTAL_LOGIN: Record<Portal, string> = {
  admin: "/login",
  manager: "/manager/login",
  employee: "/employee/login",
};

export type CashEntry = {
  id: string;
  user_id: string | null;
  entry_date: string;
  cash_sales: number;
  supermarket_expenses: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CashEntryWithManager = CashEntry & {
  manager_name: string | null;
  manager_email: string | null;
};

export type EmploymentStatus = "active" | "inactive" | "left";

export type EmployeePosition =
  | "Manager"
  | "KTM (Supervisor)"
  | "Kitchen Team Member"
  | "Driver"
  | "Supervisor";

export const POSITION_OPTIONS: EmployeePosition[] = [
  "Manager",
  "KTM (Supervisor)",
  "Kitchen Team Member",
  "Driver",
  "Supervisor",
];

export type Employee = {
  id: string;
  name: string;
  phone: string | null;
  hourly_rate: number;
  bank_weekly_hours_limit: number;
  is_active: boolean;
  joined_date: string | null;
  notes: string | null;
  created_at: string;
  // Stage 1 additions
  date_of_birth: string | null;
  gender: string | null;
  position: EmployeePosition | null;
  employment_start_date: string | null;
  hourly_ni_rate: number | null;
  hourly_cash_rate: number | null;
  store_id: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  employment_status: EmploymentStatus;
  auth_user_id: string | null;
  email: string | null;
  /** Per-driver fixed £/delivery rate (cash-flow module). Null for non-drivers. */
  delivery_rate: number | null;
};

export type EmployeeHoursSource = "manual" | "clocked";

export type EmployeeHoursRow = {
  id: string;
  employee_id: string;
  week_start_date: string;
  total_hours_worked: number;
  hourly_rate_snapshot: number;
  notes: string | null;
  logged_by: string | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  source: EmployeeHoursSource;
  created_at: string;
};

export type EmployeeHoursComputed = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_phone: string | null;
  week_start_date: string;
  total_hours_worked: number;
  bank_hours: number;
  cash_hours: number;
  cash_amount_due: number;
  hourly_rate_snapshot: number;
  notes: string | null;
  logged_by: string | null;
  approved: boolean;
  approved_at: string | null;
  source: EmployeeHoursSource;
  created_at: string;
};

export type RotaShift = {
  id: string;
  employee_id: string;
  store_id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean;
  scheduled_hours: number;
  manager_notes: string | null;
  same_day_edit_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

/**
 * One day of an employee's recurring weekly schedule template.
 * weekday: 0=Mon .. 6=Sun (matches `weekdayIndex` in lib/utils).
 * This is the contracted/default pattern — the baseline the rota is generated
 * from and that actual clock-in/out is compared against.
 */
export type EmployeeScheduleDay = {
  id: string;
  employee_id: string;
  weekday: number;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
};

export type ClockEvent = {
  id: string;
  employee_id: string;
  shift_id: string | null;
  store_id: string;
  event_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  deliveries_count: number | null;
  extra_deliveries: number;
  extra_delivery_reason: string | null;
  created_at: string;
};

export type WeeklyDelivery = {
  id: string;
  driver_id: string;
  store_id: string;
  week_start_date: string;
  manager_avg_4wk: number | null;
  vita_mojo_count: number | null;
  notes: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  // Wage
  | "wage_variance"
  | "min_wage_violation"
  // Delivery
  | "delivery_payout_high"
  | "delivery_unassigned"
  // Live dashboard
  | "late_clock_in"
  | "unexpected_absence"
  | "early_clock_out"
  // Variance
  | "scheduled_vs_actual"
  // Cash flow (Stage 2)
  | "missing_daily_entry"
  | "unresolved_discrepancy"
  | "post_office_draw"
  | "negative_cash_balance"
  | "wages_not_confirmed"
  | "unconfirmed_payment";

export type SystemAlert = {
  id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  store_id: string | null;
  employee_id: string | null;
  shift_id: string | null;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
};

export type EmployeeWeeklySummary = {
  employee_id: string;
  employee_name: string;
  position: EmployeePosition | null;
  store_id: string | null;
  week_start_date: string;
  scheduled_hours: number;
  actual_hours: number;
  deliveries_total: number;
  hourly_ni_rate: number | null;
  hourly_cash_rate: number | null;
  scheduled_ni_wages: number;
  scheduled_cash_wages: number;
  scheduled_total_wages: number;
};

export type SessionUser = {
  id: string;
  email: string;
  allowed: AllowedUser | null;
};

/** Weekly hours computed from clock_events (auto, not manually logged). */
export type ClockWeeklySummary = {
  employee_id: string;
  employee_name: string;
  week_start_date: string;
  total_hours: number;
  event_count: number;
  hourly_ni_rate: number | null;
  hourly_rate: number;
};

export type LiveDashboardStatus =
  | "on_shift"
  | "expected"
  | "clocked_out"
  | "day_off"
  | "tbc"
  | "late"
  | "absent";

// =============================================================
// CASH FLOW MODULE (Stage 2)
// =============================================================

/** One day's envelope reconciliation for a store. */
export type DailyCashEntry = {
  id: string;
  store_id: string;
  entry_date: string;
  vita_mojo_sales: number;
  envelope_amount: number;
  /** Cash spent on supermarket / supplies for the day. */
  supermarket_expenses: number;
  /** Auto-computed: vita_mojo_sales − envelope_amount. +ve = shortfall. */
  difference: number;
  reason: string | null;
  is_late: boolean;
  submitted_by: string | null;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyCashEntryWithStore = DailyCashEntry & {
  store_name: string | null;
};

export type CashPayoutStatus = "draft" | "confirmed";

/** Weekly payout header (one per store per week). */
export type CashPayout = {
  id: string;
  store_id: string;
  week_start_date: string;
  payment_date: string | null;
  status: CashPayoutStatus;
  opening_balance: number;
  cash_collected: number;
  logged_differences: number;
  actual_cash_available: number;
  total_cash_wages: number;
  total_delivery_wages: number;
  grand_total_wages: number;
  post_office_draw: number;
  surplus_carry_forward: number;
  locked: boolean;
  confirmed_by: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Per-employee line within a weekly payout. */
export type CashPayoutLine = {
  id: string;
  payout_id: string;
  employee_id: string | null;
  employee_name: string;
  role: string | null;
  cash_hours: number;
  cash_rate: number;
  cash_wage: number;
  deliveries_count: number;
  delivery_rate: number;
  delivery_wages: number;
  total_payment: number;
  is_paid: boolean;
  paid_at: string | null;
  paid_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CashPayoutWithLines = CashPayout & {
  lines: CashPayoutLine[];
  store_name: string | null;
};

/**
 * A computed wage line for an employee for a week (before persistence). Shape
 * mirrors CashPayoutLine's wage fields so the live preview and saved sheet
 * render identically.
 */
export type WageLine = {
  employee_id: string;
  employee_name: string;
  role: string | null;
  cash_hours: number;
  cash_rate: number;
  cash_wage: number;
  deliveries_count: number;
  delivery_rate: number;
  delivery_wages: number;
  total_payment: number;
};

/** The Saturday pre-payment summary (§3.4 of the spec). */
export type PrePaymentSummary = {
  store_id: string;
  week_start_date: string;
  opening_balance: number;
  vita_mojo_total: number;
  cash_collected: number;
  logged_differences: number;
  actual_cash_available: number;
  total_cash_wages: number;
  total_delivery_wages: number;
  grand_total_wages: number;
  /** grand_total_wages − actual_cash_available, clamped ≥ 0 (Post Office draw). */
  post_office_draw: number;
  /** actual_cash_available − grand_total_wages, clamped ≥ 0. */
  surplus: number;
  lines: WageLine[];
};
