import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { COLORS } from "./ui";
import { fmtMoney, fmtTokens, shortDay } from "../../shared/format";
import type { DayPoint, HourBucket } from "../../shared/types";

const axis = { stroke: "rgba(255,255,255,0.32)", fontSize: 11 };
const grid = "rgba(255,255,255,0.08)";

export function SpendArea({ points }: { points: DayPoint[] }) {
  const data = points.map((p) => ({ day: p.day, cost: p.cost }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.mint} stopOpacity={0.45} />
            <stop offset="100%" stopColor={COLORS.mint} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={(d) => shortDay(d)} {...axis} minTickGap={40} />
        <YAxis tickFormatter={(v) => fmtMoney(v)} {...axis} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => shortDay(d as number)}
          formatter={(v: number) => [fmtMoney(v), "Cost"]}
        />
        <Area type="monotone" dataKey="cost" stroke={COLORS.mint} strokeWidth={2} fill="url(#spend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourlyBars({ buckets, metric }: { buckets: HourBucket[]; metric: "cost" | "tokens" }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="hour" tickFormatter={(h) => `${h}`} {...axis} />
        <YAxis tickFormatter={(v) => (metric === "cost" ? fmtMoney(v) : fmtTokens(v))} {...axis} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(h) => `${h}:00`}
          formatter={(v: number) => [metric === "cost" ? fmtMoney(v) : fmtTokens(v), metric]}
        />
        <Bar dataKey={metric} radius={[3, 3, 0, 0]}>
          {buckets.map((b) => {
            const night = b.hour < 6 || b.hour >= 22;
            return <Cell key={b.hour} fill={night ? COLORS.coral : COLORS.cyan} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutShare({ data }: { data: { label: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [fmtMoney(v), n as string]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  background: "rgba(13,15,23,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 12,
  color: "#fff",
};

// A token-split horizontal bar (input / cacheCreate / cacheRead / output).
export function TokenSplitBar({
  t,
}: {
  t: { input: number; cacheCreate: number; cacheRead: number; output: number };
}) {
  const total = t.input + t.cacheCreate + t.cacheRead + t.output || 1;
  const segs = [
    { v: t.input, c: COLORS.cyan },
    { v: t.cacheCreate, c: COLORS.amber },
    { v: t.cacheRead, c: COLORS.lime },
    { v: t.output, c: COLORS.coral },
  ];
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full">
      {segs.map((s, i) => (
        <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />
      ))}
    </div>
  );
}
