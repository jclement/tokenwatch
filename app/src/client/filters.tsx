// The filter bar's state (which engines / machines / models are checked, and
// whether charts plot cost or tokens) plus the derived, filtered view every
// filter-aware page reads. Remembered per browser in localStorage.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useStats } from "./data";
import { deriveView, modelId, noFilters, type Filters, type Metric, type SeriesDef, type View } from "./view";
import type { StatsPayload } from "../shared/types";

const KEY = "tw.filters.v1";

// Categorical slots, validated as a set against the dark surface (#11131c) with
// the dataviz validator: lightness band, chroma floor, adjacent-pair CVD
// separation (worst ΔE 14.8), normal-vision floor and 3:1 contrast all pass.
// Order is the CVD-safety mechanism — don't reshuffle without re-running it.
export const SERIES = ["#00a2ce", "#c98000", "#db5dab", "#71a428", "#7e5acc", "#00996b", "#2e62c9", "#d24b54"];
export const OTHER = "#5b6170"; // folded tail + unattributed: a neutral, never a ninth hue

export const ENGINE_COLOR: Record<string, string> = { Codex: SERIES[0], Claude: SERIES[1] };

interface Stored {
  filters: Filters;
  metric: Metric;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Stored>;
      return {
        filters: { ...noFilters(), ...(s.filters ?? {}) },
        metric: s.metric === "tokens" ? "tokens" : "cost",
      };
    }
  } catch {
    /* private window / blocked storage: defaults */
  }
  return { filters: noFilters(), metric: "cost" };
}

interface FilterState {
  filters: Filters;
  metric: Metric;
  setMetric: (m: Metric) => void;
  toggle: (dim: keyof Filters, key: string) => void;
  setOff: (dim: keyof Filters, keys: string[]) => void;
  reset: () => void;
}

const Ctx = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(load);

  const save = useCallback((next: Stored) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<FilterState>(
    () => ({
      filters: state.filters,
      metric: state.metric,
      setMetric: (metric) => save({ ...state, metric }),
      toggle: (dim, key) => {
        const cur = state.filters[dim];
        const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
        save({ ...state, filters: { ...state.filters, [dim]: next } });
      },
      setOff: (dim, keys) => save({ ...state, filters: { ...state.filters, [dim]: keys } }),
      reset: () => save({ ...state, filters: noFilters() }),
    }),
    [state, save],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): FilterState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFilters outside FilterProvider");
  return v;
}

// Stable identity colors: an entity's slot comes from its all-time rank
// (unfiltered), so unchecking a model never repaints the ones that remain.
export interface Palette {
  models: SeriesDef[]; // all-time cost order
  machines: SeriesDef[];
  engines: SeriesDef[];
  color: (key: string) => string;
}

export function buildPalette(stats: StatsPayload): Palette {
  const all = deriveView(stats, noFilters());
  const models = all.byModel.map((s) => ({ key: s.key, label: s.label }));
  // Every known machine, even one with no usage yet, so the filter lists it.
  const ranked = all.byMachine.map((s) => s.key);
  const machineKeys = [...ranked, ...stats.cube.machines.map((m) => m.id).filter((id) => !ranked.includes(id))];
  const names = new Map(stats.cube.machines.map((m) => [m.id, m.name]));
  const machines = machineKeys.map((k) => ({ key: k, label: names.get(k) ?? k }));
  const engines = all.byEngine.map((s) => ({ key: s.key, label: s.label }));
  const colors = new Map<string, string>();
  models.forEach((m, i) => colors.set(m.key, SERIES[i] ?? OTHER));
  machines
    .filter((m) => m.key !== "")
    .forEach((m, i) => colors.set(`machine:${m.key}`, SERIES[i] ?? OTHER));
  colors.set("machine:", OTHER);
  return {
    models,
    machines,
    engines,
    color: (key) => ENGINE_COLOR[key] ?? colors.get(key) ?? colors.get(`machine:${key}`) ?? OTHER,
  };
}

// The filtered view + palette for the current stats, memoized.
export function useView(): { view: View; palette: Palette; metric: Metric; stats: StatsPayload } | null {
  const { stats } = useStats();
  const { filters, metric } = useFilters();
  const palette = useMemo(() => (stats?.cube ? buildPalette(stats) : null), [stats]);
  const view = useMemo(() => (stats?.cube ? deriveView(stats, filters) : null), [stats, filters]);
  if (!stats || !view || !palette) return null;
  return { view, palette, metric, stats };
}

export { modelId };
