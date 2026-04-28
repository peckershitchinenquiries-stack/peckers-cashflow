export type AllowedUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "manager";
  created_at: string;
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
};

export type EmployeeHoursRow = {
  id: string;
  employee_id: string;
  week_start_date: string;
  total_hours_worked: number;
  hourly_rate_snapshot: number;
  notes: string | null;
  logged_by: string | null;
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
  created_at: string;
};

export type SessionUser = {
  id: string;
  email: string;
  allowed: AllowedUser | null;
};
