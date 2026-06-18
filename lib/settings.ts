// =============================================================
// App-configurable settings: alert thresholds, minimum-wage bands, and email
// notification config. Stored in the `app_settings` table (key -> JSONB), but
// this module supplies the DEFAULTS and merges any stored overrides over them,
// so the app works correctly even when the table is empty.
//
// PURE module (no server/Supabase imports) — safe to import from client UI too.
// =============================================================

/** Thresholds the alert scanner (app/actions/alerts.ts -> runScan) uses. */
export type AlertThresholds = {
  /** wage_variance: |this-week vs 4-week-avg scheduled hours| deviation, %. */
  wage_variance_pct: number;
  /** delivery_payout_high: this-week deliveries > avg × this multiplier. */
  delivery_spike_multiplier: number;
  /** late_clock_in: minutes past scheduled start before flagging "late". */
  late_clock_in_min: number;
  /** unexpected_absence: minutes past scheduled start with no clock-in. */
  absence_min: number;
  /** early_clock_out: minutes before scheduled end before flagging. */
  early_clock_out_min: number;
  /** scheduled_vs_actual: |worked vs scheduled hours| variance, %. */
  scheduled_vs_actual_pct: number;
};

/** UK National Minimum / Living Wage bands (editable each April in Settings). */
export type MinWageBands = {
  enabled: boolean;
  /** National Living Wage — 21 and over. */
  nlw_21_plus: number;
  age_18_20: number;
  under_18: number;
  /** Human label for which rates these are, e.g. "April 2025". */
  effective_label: string;
};

export type EmailAlertSettings = {
  enabled: boolean;
  /** Explicit real inbox addresses. Empty = fall back to admin emails. */
  recipients: string[];
};

/** Cash-flow module configuration (daily entries, payout, carry-forward). */
export type CashFlowSettings = {
  /** Carry last week's surplus into next week's opening balance. */
  carry_forward_surplus: boolean;
  /** Hour (0–23) after which a store with no daily entry is flagged missing. */
  missing_entry_hour: number;
  /** Hour (0–23) on Tuesday (payday) after which unconfirmed wages are flagged. */
  wages_confirm_hour: number;
  /**
   * Default supermarket cash added to each Tuesday payout — money the business
   * already holds from supermarket takings, used to pay wages before any Post
   * Office draw. Counts toward "actual cash available"; the rest is surplus.
   */
  supermarket_default_cash: number;
};

export type AppSettings = {
  alert_thresholds: AlertThresholds;
  min_wage_bands: MinWageBands;
  email_alerts: EmailAlertSettings;
  cash_flow: CashFlowSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  alert_thresholds: {
    wage_variance_pct: 20,
    delivery_spike_multiplier: 1.5,
    late_clock_in_min: 15,
    absence_min: 60,
    early_clock_out_min: 30,
    scheduled_vs_actual_pct: 25,
  },
  min_wage_bands: {
    enabled: true,
    // UK NMW/NLW effective 1 April 2025.
    nlw_21_plus: 12.21,
    age_18_20: 10.0,
    under_18: 7.55,
    effective_label: "April 2025",
  },
  email_alerts: {
    enabled: false,
    recipients: [],
  },
  cash_flow: {
    carry_forward_surplus: true,
    missing_entry_hour: 23,
    wages_confirm_hour: 18,
    supermarket_default_cash: 700,
  },
};

export const SETTINGS_KEYS = [
  "alert_thresholds",
  "min_wage_bands",
  "email_alerts",
  "cash_flow",
] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

/**
 * Merge `app_settings` rows (key -> stored JSONB value) over the defaults,
 * field-by-field, so partial/old stored objects don't drop newer fields.
 */
export function mergeSettings(
  rows: Array<{ key: string; value: unknown }> | null | undefined,
): AppSettings {
  const byKey = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const pick = <K extends SettingsKey>(k: K): AppSettings[K] => {
    const stored = byKey.get(k);
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      return { ...DEFAULT_SETTINGS[k], ...(stored as object) } as AppSettings[K];
    }
    return DEFAULT_SETTINGS[k];
  };
  return {
    alert_thresholds: pick("alert_thresholds"),
    min_wage_bands: pick("min_wage_bands"),
    email_alerts: pick("email_alerts"),
    cash_flow: pick("cash_flow"),
  };
}
