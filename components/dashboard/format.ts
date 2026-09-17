import { formatDDMMYYYY } from "@/lib/utils";

export const ddmm = (iso: string) => formatDDMMYYYY(iso).slice(0, 5);

/** A fraction as WeeklySummaryTable prints it: always two decimals. */
export const fractionPct = (v: number) => `${(v * 100).toFixed(2)}%`;
