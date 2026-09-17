export type LiveSalesStoreRow = {
  store: string;
  grossSales: number;
  orders: number;
  aov: number | null;
};

export type LiveSalesTimelinePoint = {
  time: string;
  grossSales: number;
  cumulative: number;
};

export type LiveGrossSalesResponse = {
  businessDate: string;
  asOf: string;
  sourceLatencyMinutes: string;
  salesType: string;
  stale: boolean;
  error?: string;
  timelineGranularity?: string;
  totals: { grossSales: number; orders: number; aov: number | null };
  byStore: LiveSalesStoreRow[];
  timeline: LiveSalesTimelinePoint[];
};

export type LiveSalesFailureReason =
  | "not_configured"
  | "unauthorized"
  | "unavailable"
  | "timeout"
  | "network"
  | "bad_response";

export type LiveSalesResult =
  | { ok: true; data: LiveGrossSalesResponse }
  | { ok: false; reason: LiveSalesFailureReason; status?: number };
