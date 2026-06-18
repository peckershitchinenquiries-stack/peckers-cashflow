"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

function gbpTick(v: number) {
  return `£${Math.round(v).toLocaleString()}`;
}

export function BarChartCard({
  data,
  xKey,
  bars,
  height = 280,
  currency = false,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; name: string; color?: string }[];
  height?: number;
  currency?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval={0} angle={0} />
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
          />
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
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  height?: number;
  currency?: boolean;
  // When true, slices are labelled with their share of the total (to 2 dp) and
  // the tooltip shows the percentage rather than the raw value.
  showPercent?: boolean;
}) {
  const total = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
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
              ? (e: { percent?: number }) =>
                  `${truncTo((e.percent ?? 0) * 100, 2).toFixed(2)}%`
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
