"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { truncTo } from "@/lib/vm-analytics/format";

// Tracks whether the viewport is below the given breakpoint so charts can
// switch between horizontal (desktop) and angled (mobile) axis labels.
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

const PALETTE = [
  "#e11d2a",
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

const axisProps = {
  tick: { fontSize: 12, fill: "#64748b" },
  axisLine: { stroke: "#e2e8f0" },
  tickLine: false,
};

// Custom X-axis label that wraps long text into multiple lines
const WrappedXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  if (!payload?.value) return null;

  const words = String(payload.value).split(" ");
  const lines: string[] = [];
  let currentLine = "";

  // Wrap text at ~15 chars per line or by word boundaries
  for (const word of words) {
    if ((currentLine + " " + word).length > 15) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="#64748b"
      fontSize={12}
    >
      {lines.map((line, idx) => (
        <tspan key={idx} x={x} dy={idx === 0 ? 12 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

// Angled X-axis label for narrow (mobile) widths. Anchoring at the end and
// rotating around the tick origin makes the labels fan down to the left, so
// they never overlap each other or the content below them.
const AngledXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  if (!payload?.value) return null;

  const value = String(payload.value);
  const label = value.length > 20 ? `${value.slice(0, 19)}…` : value;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="end"
        transform="rotate(-35)"
        fill="#64748b"
        fontSize={11}
      >
        {label}
      </text>
    </g>
  );
};

function gbpTick(v: number) {
  return `£${Math.round(v).toLocaleString()}`;
}

export function BarChartCard({
  data,
  xKey,
  bars,
  height = 280,
  currency = false,
  labelKey,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; name: string; color?: string }[];
  height?: number;
  currency?: boolean;
  // When set, the value at data[labelKey] is drawn on top of each bar (e.g. the
  // trading window "(11-2pm)" above each daypart). Only applied to the first bar.
  labelKey?: string;
}) {
  const isMobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 4, bottom: isMobile ? 0 : 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey={xKey}
          {...axisProps}
          interval={0}
          height={isMobile ? 90 : 70}
          tick={isMobile ? <AngledXAxisTick /> : <WrappedXAxisTick />}
        />
        <YAxis {...axisProps} tickFormatter={currency ? gbpTick : undefined} />
        <Tooltip
          formatter={(v: number) =>
            currency ? `£${Number(v).toLocaleString()}` : v.toLocaleString()
          }
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name}
            fill={b.color ?? PALETTE[i % PALETTE.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          >
            {labelKey && i === 0 && (
              <LabelList
                dataKey={labelKey}
                position="top"
                style={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({
  data,
  xKey,
  lines,
  height = 280,
  currency = false,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; name: string; color?: string }[];
  height?: number;
  currency?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={currency ? gbpTick : undefined} />
        <Tooltip
          formatter={(v: number) =>
            currency ? `£${Number(v).toLocaleString()}` : v.toLocaleString()
          }
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PieChartCard({
  data,
  nameKey,
  valueKey,
  height = 280,
  currency = true,
  showPercent = false,
  percentTotal,
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  height?: number;
  currency?: boolean;
  // When true, slices are labelled with their share of the total (to 2 dp) and
  // the tooltip shows the percentage rather than the raw value.
  showPercent?: boolean;
  // External denominator for the share %. When set (>0), percentages are
  // value/percentTotal rather than value/sum-of-slices, so slices need not
  // sum to 100% (e.g. dividing category net sales by the exec net-sales total).
  percentTotal?: number;
}) {
  const sliceTotal = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
  const total = percentTotal && percentTotal > 0 ? percentTotal : sliceTotal;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
          label={
            showPercent
              ? (e: { value?: number; percent?: number }) =>
                  total > 0
                    ? `${truncTo((Number(e.value ?? 0) / total) * 100, 2).toFixed(2)}%`
                    : `${truncTo((e.percent ?? 0) * 100, 2).toFixed(2)}%`
              : undefined
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) =>
            showPercent
              ? `${total > 0 ? truncTo((Number(v) / total) * 100, 2).toFixed(2) : "0.00"}%`
              : currency
              ? `£${Number(v).toLocaleString()}`
              : Number(v).toLocaleString()
          }
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
