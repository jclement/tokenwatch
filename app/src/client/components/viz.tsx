// Filter-aware chart pieces: stacked areas, share comparisons, the machine ×
// model heatmap, donuts and the sortable breakdown table. One y-axis per chart;
// identity colors come from the stable palette (filters.tsx), text stays in
// ink tokens and never wears a series color.

import { useState, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { fmtMoney, fmtTokens, shortDay } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";
import type { Metric, SeriesDef, Slice } from "../view";
import { metricOf, perMillion } from "../view";

export const fmtMetric = (v: number, m: Metric) => (m === "cost" ? fmtMoney(v) : fmtTokens(v));

const axis = { stroke: "rgba(255,255,255,0.32)", fontSize: 11, tickLine: false, axisLine: false };
const grid = "rgba(255,255,255,0.06)";

// ---- Tooltip -------------------------------------------------------------------

interface TipItem {
  dataKey?: string | number;
  value?: number;
  color?: string;
  name?: string;
}

function GlassTip({
  active,
  payload,
  label,
  metric,
  labelFmt,
  names,
  total = true,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: number;
  metric: Metric;
  labelFmt: (l: number) => string;
  names: Map<string, string>;
  total?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => (p.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const sum = items.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="min-w-[180px] rounded-xl border border-white/10 bg-[#0d0f17f2] px-3 py-2.5 text-[12px] shadow-2xl backdrop-blur-md">
      <div className="mb-1.5 flex items-baseline gap-3">
        <span className="font-semibold text-ink">{labelFmt(label ?? 0)}</span>
        {total && items.length > 1 && <span className="ml-auto font-bold tabular-nums text-ink">{fmtMetric(sum, metric)}</span>}
      </div>
      {items.length === 0 && <div className="text-faint">Nothing</div>}
      {items.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
          <span className="max-w-[170px] truncate text-subtle">{names.get(String(p.dataKey)) ?? p.name}</span>
          <span className="ml-auto pl-3 tabular-nums text-ink">{fmtMetric(p.value ?? 0, metric)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Legend --------------------------------------------------------------------

export function Legend({ series, color }: { series: SeriesDef[]; color: (k: string) => string }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
      {series.map((s) => (
        <span key={s.key} className="inline-flex min-w-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(s.key) }} />
          <span className="max-w-[200px] truncate text-subtle">{s.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---- Stacked area ----------------------------------------------------------------

export function StackedArea({
  rows,
  series,
  metric,
  color,
  height = 260,
}: {
  rows: Record<string, number>[];
  series: SeriesDef[];
  metric: Metric;
  color: (k: string) => string;
  height?: number;
}) {
  const names = new Map(series.map((s) => [s.key, s.label]));
  const id = (k: string) => `g-${k.replace(/[^a-zA-Z0-9]/g, "_")}`;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={id(s.key)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color(s.key)} stopOpacity={0.85} />
                <stop offset="100%" stopColor={color(s.key)} stopOpacity={0.35} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d) => shortDay(d)} {...axis} minTickGap={40} />
          <YAxis tickFormatter={(v) => fmtMetric(v, metric)} {...axis} width={58} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
            content={<GlassTip metric={metric} labelFmt={(d) => shortDay(d)} names={names} />}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="1"
              stroke={color(s.key)}
              strokeWidth={1.5}
              fill={`url(#${id(s.key)})`}
              isAnimationActive={false}
              activeDot={{ r: 4, stroke: "#0d0f17", strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {series.length > 1 && (
        <div className="mt-3">
          <Legend series={series} color={color} />
        </div>
      )}
    </div>
  );
}

// Running total — the "how did we get here" line.
export function CumulativeLine({ points, metric }: { points: { day: number; value: number }[]; metric: Metric }) {
  let acc = 0;
  const data = points.map((p) => ({ day: p.day, total: (acc += p.value) }));
  const names = new Map([["total", "Running total"]]);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-cyan)" />
            <stop offset="100%" stopColor="var(--color-mint)" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={(d) => shortDay(d)} {...axis} minTickGap={40} />
        <YAxis tickFormatter={(v) => fmtMetric(v, metric)} {...axis} width={58} />
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
          content={<GlassTip metric={metric} labelFmt={(d) => shortDay(d)} names={names} total={false} />}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="url(#cum)"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
          activeDot={{ r: 5, fill: "var(--color-mint)", stroke: "#0d0f17", strokeWidth: 2 }}
          style={{ filter: "drop-shadow(0 0 6px rgba(102,242,189,0.45))" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---- Share of cost vs share of tokens -------------------------------------------

// Two bars per entity on the same 0–100% scale: what fraction of the money and
// what fraction of the tokens it accounts for. A model that is 70% of the bill
// on 20% of the tokens is the whole story of model choice.
export function ShareCompare({ slices, color }: { slices: Slice[]; color: (k: string) => string }) {
  const cost = slices.reduce((s, x) => s + x.cost, 0) || 1;
  const toks = slices.reduce((s, x) => s + totalTokens(x.tokens), 0) || 1;
  const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-4 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-sm bg-white/70" /> share of cost
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-sm border border-white/50 bg-white/15" /> share of tokens
        </span>
      </div>
      {slices.map((s) => {
        const c = s.cost / cost;
        const t = totalTokens(s.tokens) / toks;
        const col = color(s.key);
        return (
          <div key={s.key} className="group" title={`${s.label}: ${pct(c)} of cost, ${pct(t)} of tokens`}>
            <div className="mb-1 flex items-baseline gap-2 text-[12px]">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: col }} />
              <span className="min-w-0 truncate text-ink">{s.label}</span>
              <span className="ml-auto tabular-nums text-ink">{pct(c)}</span>
              <span className="w-12 text-right tabular-nums text-faint">{pct(t)}</span>
            </div>
            <div className="space-y-[2px]">
              <div className="h-2 overflow-hidden rounded-r-full bg-white/[0.04]">
                <div className="h-full rounded-r-full" style={{ width: `${c * 100}%`, background: col, boxShadow: `0 0 12px -2px ${col}` }} />
              </div>
              <div className="h-2 overflow-hidden rounded-r-full bg-white/[0.04]">
                <div
                  className="h-full rounded-r-full border"
                  style={{ width: `${t * 100}%`, background: `${col}33`, borderColor: `${col}aa` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Donut -------------------------------------------------------------------------

export function Donut({
  slices,
  metric,
  color,
  caption,
}: {
  slices: Slice[];
  metric: Metric;
  color: (k: string) => string;
  caption: string;
}) {
  const data = slices.map((s) => ({ key: s.key, label: s.label, value: metricOf(s, metric) })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const names = new Map(data.map((d) => [d.key, d.label]));
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={66}
            outerRadius={92}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="#0d0f17"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={color(d.key)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <GlassTip
                  active
                  payload={payload.map((p) => ({
                    dataKey: (p.payload as { key: string }).key,
                    value: p.value as number,
                    color: color((p.payload as { key: string }).key),
                  }))}
                  label={0}
                  labelFmt={() => `${(((payload[0].value as number) / (total || 1)) * 100).toFixed(1)}% of ${caption.toLowerCase()}`}
                  metric={metric}
                  names={names}
                  total={false}
                />
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-wider text-faint">{caption}</div>
        <div className="text-[20px] font-extrabold tabular-nums text-ink">{fmtMetric(total, metric)}</div>
      </div>
    </div>
  );
}

// ---- Heatmap (machine × model) ------------------------------------------------------

// Sequential single hue (cyan): transparent → saturated, magnitude only.
export function Heatmap({
  rows,
  cols,
  value,
  metric,
}: {
  rows: SeriesDef[];
  cols: SeriesDef[];
  value: (row: string, col: string) => number;
  metric: Metric;
}) {
  const max = Math.max(0, ...rows.flatMap((r) => cols.map((c) => value(r.key, c.key)))) || 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c.key} className="max-w-[120px] px-1 pb-1 text-left align-bottom font-medium text-subtle">
                <div className="truncate" title={c.label}>
                  {c.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th className="max-w-[140px] truncate pr-2 text-left font-medium text-ink" title={r.label}>
                {r.label}
              </th>
              {cols.map((c) => {
                const v = value(r.key, c.key);
                const a = v / max;
                return (
                  <td
                    key={c.key}
                    title={`${r.label} × ${c.label}: ${fmtMetric(v, metric)}`}
                    className="h-10 min-w-[64px] rounded-md px-2 text-right tabular-nums transition hover:ring-1 hover:ring-white/40"
                    style={{
                      background: v > 0 ? `rgba(92,199,250,${0.08 + a * 0.72})` : "rgba(255,255,255,0.02)",
                      color: a > 0.55 ? "#0d0f17" : "var(--color-ink)",
                      boxShadow: a > 0.6 ? "0 0 18px -6px rgba(92,199,250,0.9)" : undefined,
                    }}
                  >
                    {v > 0 ? fmtMetric(v, metric) : <span className="text-faint">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Sortable breakdown table ---------------------------------------------------------

type Col = "label" | "cost" | "tokens" | "input" | "cacheCreate" | "cacheRead" | "output" | "rate";

const COLS: { key: Col; label: string; hint?: string; wide?: boolean }[] = [
  { key: "cost", label: "Cost" },
  { key: "tokens", label: "Tokens" },
  { key: "input", label: "Input", wide: true },
  { key: "cacheCreate", label: "Cache W", hint: "Cache writes", wide: true },
  { key: "cacheRead", label: "Cache R", hint: "Cache reads", wide: true },
  { key: "output", label: "Output", wide: true },
  { key: "rate", label: "$/M", hint: "Blended dollars per million tokens", wide: true },
];

function colValue(s: Slice, c: Col): number | string {
  switch (c) {
    case "label":
      return s.label.toLowerCase();
    case "cost":
      return s.cost;
    case "tokens":
      return totalTokens(s.tokens);
    case "rate":
      return perMillion(s);
    default:
      return s.tokens[c];
  }
}

export function BreakdownTable({
  slices,
  color,
  name = "Name",
  extra,
}: {
  slices: Slice[];
  color: (k: string) => string;
  name?: string;
  extra?: (s: Slice) => ReactNode;
}) {
  const [sort, setSort] = useState<{ col: Col; desc: boolean }>({ col: "cost", desc: true });
  const sorted = [...slices].sort((a, b) => {
    const x = colValue(a, sort.col);
    const y = colValue(b, sort.col);
    const d = x < y ? -1 : x > y ? 1 : 0;
    return sort.desc ? -d : d;
  });
  const totalCost = slices.reduce((s, x) => s + x.cost, 0) || 1;
  const click = (col: Col) => setSort((s) => ({ col, desc: s.col === col ? !s.desc : col !== "label" }));
  const arrow = (col: Col) => (sort.col === col ? (sort.desc ? " ↓" : " ↑") : "");
  const th = "cursor-pointer select-none whitespace-nowrap px-2 py-2 font-medium text-faint hover:text-ink";

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider">
            <th className={`${th} text-left`} onClick={() => click("label")} aria-sort={sort.col === "label" ? (sort.desc ? "descending" : "ascending") : "none"}>
              {name}
              {arrow("label")}
            </th>
            {COLS.map((c) => (
              <th
                key={c.key}
                title={c.hint}
                onClick={() => click(c.key)}
                aria-sort={sort.col === c.key ? (sort.desc ? "descending" : "ascending") : "none"}
                className={`${th} text-right ${c.wide ? "hidden md:table-cell" : ""}`}
              >
                {c.label}
                {arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.key} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
              <td className="max-w-[260px] px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(s.key) }} />
                  <span className="truncate font-medium text-ink" title={s.label}>
                    {s.label}
                  </span>
                  {extra?.(s)}
                </div>
                <div className="ml-[18px] mt-1 h-1 max-w-[180px] overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${(s.cost / totalCost) * 100}%`, background: color(s.key) }} />
                </div>
              </td>
              <td className="px-2 py-2 text-right font-bold tabular-nums">{fmtMoney(s.cost)}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtTokens(totalTokens(s.tokens))}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-subtle md:table-cell">{fmtTokens(s.tokens.input)}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-subtle md:table-cell">{fmtTokens(s.tokens.cacheCreate)}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-subtle md:table-cell">{fmtTokens(s.tokens.cacheRead)}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-subtle md:table-cell">{fmtTokens(s.tokens.output)}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-subtle md:table-cell">${perMillion(s).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tiny inline trend for stat cards.
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values) || 1;
  const w = 120;
  const h = 32;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`${color}22`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Shown in place of charts when the filter bar has excluded everything.
export function NothingChecked() {
  return (
    <div className="glass flex flex-col items-center gap-2 p-10 text-center">
      <div className="text-3xl opacity-40">☐</div>
      <p className="text-[14px] text-subtle">Everything is unchecked. Nothing costs nothing — congratulations.</p>
      <p className="text-[12px] text-faint">Tick a machine, engine or model in the filter bar above.</p>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[9px] border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition ${
            value === o.value ? "bg-white/10 text-ink" : "text-faint hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
