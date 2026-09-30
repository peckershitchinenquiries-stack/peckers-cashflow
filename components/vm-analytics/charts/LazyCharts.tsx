"use client";

import dynamic from "next/dynamic";

/**
 * Code-split entry point for the chart cards.
 *
 * Charts.tsx pulls in recharts, which dominates the vm-analytics route chunks.
 * The dashboards are server components, and a server component cannot itself
 * call next/dynamic with ssr disabled -- so the split happens here, in a client
 * module the pages import instead of Charts directly.
 *
 * ssr is left ON (the default). It gives the same bundle saving as disabling
 * it, while keeping server rendering, hydration and the charts' own empty
 * states exactly as they were: recharts' ResponsiveContainer measures the DOM,
 * so these render empty on the server either way. Disabling ssr would add a
 * visible placeholder where there is currently none.
 *
 * Re-exported under the same names as Charts.tsx so call sites only change
 * which module they import from.
 */
export const BarChartCard = dynamic(() =>
  import("./Charts").then((m) => m.BarChartCard),
);
export const LineChartCard = dynamic(() =>
  import("./Charts").then((m) => m.LineChartCard),
);
export const ComboChartCard = dynamic(() =>
  import("./Charts").then((m) => m.ComboChartCard),
);
export const PieChartCard = dynamic(() =>
  import("./Charts").then((m) => m.PieChartCard),
);
