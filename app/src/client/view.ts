// Client-side slicing of the stats cube: apply the filter bar's checkboxes and
// re-aggregate into every shape the filtered pages draw. Pure, so it is tested
// without a DOM (view.test.ts).

import { addTotals, emptyTotals, totalTokens, type Engine, type TokenTotals } from "../shared/pricing";
import type { HourBucket, MachineInfo, ModelKey, SessionAgg, StatsCube, StatsPayload } from "../shared/types";

export type Metric = "cost" | "tokens";
export type SplitBy = "model" | "engine" | "machine";

// What the filter bar has switched OFF. Exclusions (not inclusions) are stored
// so a model or machine that appears later is shown by default.
export interface Filters {
  engines: string[];
  models: string[]; // modelId()
  machines: string[]; // MachineInfo.id
}

export const noFilters = (): Filters => ({ engines: [], models: [], machines: [] });

export const modelId = (m: ModelKey) => `${m.engine}:${m.model}`;

export interface Slice {
  key: string; // stable id: modelId, engine name or machine id
  label: string;
  engine: Engine | null; // null for machines
  tokens: TokenTotals;
  cost: number;
  machine?: MachineInfo;
}

export interface SeriesDef {
  key: string;
  label: string;
}

export interface View {
  filtered: boolean; // any checkbox off
  grandTotals: TokenTotals;
  grandCost: number;
  activeDays: number;
  days: { day: number; tokens: TokenTotals; cost: number }[];
  byModel: Slice[];
  byEngine: Slice[];
  byMachine: Slice[];
  hourly: HourBucket[];
  // day × model × machine, for stacked-over-time and machine×model matrices
  cells: Cell[];
  sessions: SessionAgg[];
}

export interface Cell {
  day: number;
  model: string; // modelId
  engine: Engine;
  machine: string;
  tokens: TokenTotals;
  cost: number;
}

const tupleTotals = (r: number[]): TokenTotals => ({
  input: r[3],
  cacheRead: r[4],
  cacheCreate: r[5],
  cacheCreate1h: r[6],
  output: r[7],
});

export function isFiltered(f: Filters): boolean {
  return f.engines.length + f.models.length + f.machines.length > 0;
}

function rank(map: Map<string, Slice>): Slice[] {
  return [...map.values()].sort((a, b) => b.cost - a.cost || totalTokens(b.tokens) - totalTokens(a.tokens));
}

function bump(map: Map<string, Slice>, init: () => Slice, t: TokenTotals, cost: number, key: string) {
  const s = map.get(key) ?? init();
  s.tokens = addTotals(s.tokens, t);
  s.cost += cost;
  map.set(key, s);
}

export function deriveView(stats: StatsPayload, f: Filters): View {
  const cube: StatsCube = stats.cube;
  const offEngine = new Set(f.engines);
  const offModel = new Set(f.models);
  const offMachine = new Set(f.machines);
  const modelOn = cube.models.map((m) => !offEngine.has(m.engine) && !offModel.has(modelId(m)));
  const machineOn = cube.machines.map((m) => !offMachine.has(m.id));

  const byDay = new Map<number, { tokens: TokenTotals; cost: number }>();
  const byModel = new Map<string, Slice>();
  const byEngine = new Map<string, Slice>();
  const byMachine = new Map<string, Slice>();
  const cells: Cell[] = [];
  let grand = emptyTotals();
  let grandCost = 0;

  for (const r of cube.rows) {
    const [day, mi, di] = r;
    if (!modelOn[mi] || !machineOn[di]) continue;
    const m = cube.models[mi];
    const mach = cube.machines[di];
    const t = tupleTotals(r);
    const cost = r[8];
    grand = addTotals(grand, t);
    grandCost += cost;
    const d = byDay.get(day) ?? { tokens: emptyTotals(), cost: 0 };
    d.tokens = addTotals(d.tokens, t);
    d.cost += cost;
    byDay.set(day, d);
    const mid = modelId(m);
    bump(byModel, () => ({ key: mid, label: m.model, engine: m.engine, tokens: emptyTotals(), cost: 0 }), t, cost, mid);
    bump(byEngine, () => ({ key: m.engine, label: m.engine, engine: m.engine, tokens: emptyTotals(), cost: 0 }), t, cost, m.engine);
    bump(
      byMachine,
      () => ({ key: mach.id, label: mach.name, engine: null, machine: mach, tokens: emptyTotals(), cost: 0 }),
      t,
      cost,
      mach.id,
    );
    cells.push({ day, model: mid, engine: m.engine, machine: mach.id, tokens: t, cost });
  }

  const hCost = new Array(24).fill(0);
  const hTok = new Array(24).fill(0);
  for (const [hour, mi, di, tok, cost] of cube.hourRows) {
    if (!modelOn[mi] || !machineOn[di]) continue;
    hCost[hour] += cost;
    hTok[hour] += tok;
  }

  const sessions = stats.topSessions.filter(
    (s) =>
      !offEngine.has(s.engine) &&
      !offModel.has(modelId({ engine: s.engine, model: s.model })) &&
      !offMachine.has(s.device),
  );

  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, v]) => ({ day, ...v }));
  return {
    filtered: isFiltered(f),
    grandTotals: grand,
    grandCost,
    activeDays: days.length,
    days,
    byModel: rank(byModel),
    byEngine: rank(byEngine),
    byMachine: rank(byMachine),
    hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, cost: hCost[h], tokens: hTok[h] })),
    cells,
    sessions,
  };
}

const keyOf = (c: Cell, by: SplitBy) => (by === "model" ? c.model : by === "engine" ? c.engine : c.machine);

// Wide rows for a stacked chart: one row per day (gaps filled with zero so the
// stack doesn't interpolate across idle days), one numeric column per series.
// Series past `maxSeries` fold into "other" so the palette never cycles.
export function stackByDay(
  view: View,
  by: SplitBy,
  metric: Metric,
  order: SeriesDef[],
  maxSeries = 7,
): { rows: Record<string, number>[]; series: SeriesDef[] } {
  const present = new Set(view.cells.map((c) => keyOf(c, by)));
  const ordered = order.filter((s) => present.has(s.key));
  const head = ordered.slice(0, ordered.length > maxSeries + 1 ? maxSeries : maxSeries + 1);
  const headKeys = new Set(head.map((s) => s.key));
  const series = ordered.length > head.length ? [...head, { key: "other", label: "Other" }] : head;

  if (view.days.length === 0) return { rows: [], series };
  const first = view.days[0].day;
  const last = view.days[view.days.length - 1].day;
  const rows = new Map<number, Record<string, number>>();
  for (let d = first; d <= last; d += 86400) {
    const row: Record<string, number> = { day: d };
    for (const s of series) row[s.key] = 0;
    rows.set(d, row);
  }
  for (const c of view.cells) {
    const k = keyOf(c, by);
    const row = rows.get(c.day);
    if (!row) continue;
    const col = headKeys.has(k) ? k : "other";
    row[col] += metric === "cost" ? c.cost : totalTokens(c.tokens);
  }
  return { rows: [...rows.values()], series };
}

// Machine × model matrix of a metric, for the heatmap.
export function matrix(view: View, metric: Metric): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const c of view.cells) {
    const row = out.get(c.machine) ?? new Map<string, number>();
    row.set(c.model, (row.get(c.model) ?? 0) + (metric === "cost" ? c.cost : totalTokens(c.tokens)));
    out.set(c.machine, row);
  }
  return out;
}

export const metricOf = (s: { tokens: TokenTotals; cost: number }, metric: Metric) =>
  metric === "cost" ? s.cost : totalTokens(s.tokens);

// Blended $ per million tokens — what a token of this slice actually cost.
export const perMillion = (s: { tokens: TokenTotals; cost: number }) => {
  const t = totalTokens(s.tokens);
  return t > 0 ? (s.cost / t) * 1e6 : 0;
};
