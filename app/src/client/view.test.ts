import { describe, it, expect } from "vitest";
import { buildCube } from "../shared/cube";
import { deriveView, noFilters, stackByDay, matrix, type SeriesDef } from "./view";
import { totalTokens } from "../shared/pricing";
import type { StatsPayload } from "../shared/types";

const D = 86_400;
const row = (day: number, device: string, engine: string, model: string, input: number, output = 0) => ({
  day: day * D,
  device_id: device,
  engine,
  model,
  input,
  cache_read: 0,
  cache_create: 0,
  cache_create_1h: 0,
  output,
});

const devices = [
  { id: "lap", name: "laptop", platform: "linux", arch: "amd64", last_seen_at: 1 },
  { id: "desk", name: "desk", platform: "darwin", arch: "arm64", last_seen_at: 2 },
];

function payload(): StatsPayload {
  const rows = [
    row(1, "lap", "Claude", "claude-opus-4-5", 1_000_000, 10_000),
    row(1, "desk", "Codex", "gpt-5-codex", 2_000_000),
    row(3, "lap", "Claude", "claude-sonnet-4-5", 500_000),
    row(3, "", "Claude", "claude-opus-4-5", 100_000),
    row(3, "gone", "Claude", "claude-opus-4-5", 50_000),
  ];
  const hours = rows.map((r, i) => ({ ...r, hour: i }));
  const cube = buildCube(rows, hours, devices);
  return {
    cube,
    topSessions: [
      { id: "s1", engine: "Claude", model: "claude-opus-4-5", device: "lap", start: 0, end: 1, tokens: { input: 1, cacheRead: 0, cacheCreate: 0, cacheCreate1h: 0, output: 0 }, cost: 1, messages: 1 },
      { id: "s2", engine: "Codex", model: "gpt-5-codex", device: "desk", start: 0, end: 1, tokens: { input: 1, cacheRead: 0, cacheCreate: 0, cacheCreate1h: 0, output: 0 }, cost: 1, messages: 1 },
    ],
  } as unknown as StatsPayload;
}

describe("buildCube", () => {
  it("names unattributed and removed machines and keeps paired ones first", () => {
    const { machines } = payload().cube;
    expect(machines.map((m) => m.name)).toEqual(["laptop", "desk", "Unattributed", "Removed machine"]);
    expect(machines[3].removed).toBe(true);
    expect(machines[2].removed).toBe(false);
  });

  it("dedups (engine, model) pairs", () => {
    expect(payload().cube.models).toHaveLength(3);
  });
});

describe("deriveView", () => {
  it("aggregates everything with no filters", () => {
    const v = deriveView(payload(), noFilters());
    expect(totalTokens(v.grandTotals)).toBe(3_660_000);
    expect(v.activeDays).toBe(2);
    expect(v.byMachine.map((m) => m.key).sort()).toEqual(["", "desk", "gone", "lap"]);
    expect(v.filtered).toBe(false);
    const sum = v.byModel.reduce((s, m) => s + m.cost, 0);
    expect(sum).toBeCloseTo(v.grandCost, 6);
  });

  it("drops an unchecked machine from every aggregate", () => {
    const v = deriveView(payload(), { ...noFilters(), machines: ["desk"] });
    expect(v.byEngine.map((e) => e.key)).toEqual(["Claude"]);
    expect(v.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(v.hourly[1].tokens).toBe(0);
    expect(v.filtered).toBe(true);
  });

  it("drops an unchecked engine and model", () => {
    const v = deriveView(payload(), { engines: ["Codex"], models: ["Claude:claude-sonnet-4-5"], machines: [] });
    expect(v.byModel.map((m) => m.label)).toEqual(["claude-opus-4-5"]);
    expect(totalTokens(v.grandTotals)).toBe(1_160_000);
  });
});

describe("stackByDay", () => {
  it("fills idle days with zeros and sums per series", () => {
    const v = deriveView(payload(), noFilters());
    const order: SeriesDef[] = v.byMachine.map((m) => ({ key: m.key, label: m.label }));
    const { rows, series } = stackByDay(v, "machine", "tokens", order);
    expect(rows.map((r) => r.day)).toEqual([1 * D, 2 * D, 3 * D]);
    expect(rows[1].lap).toBe(0);
    expect(rows[0].desk).toBe(2_000_000);
    expect(series).toHaveLength(4);
  });

  it("folds series past the cap into Other", () => {
    const v = deriveView(payload(), noFilters());
    const order: SeriesDef[] = v.byMachine.map((m) => ({ key: m.key, label: m.label }));
    const { rows, series } = stackByDay(v, "machine", "tokens", order, 2);
    expect(series.map((s) => s.key).at(-1)).toBe("other");
    expect(series).toHaveLength(3);
    const total = rows.reduce((s, r) => s + series.reduce((a, x) => a + r[x.key], 0), 0);
    expect(total).toBe(3_660_000);
  });
});

describe("matrix", () => {
  it("crosses machines with models", () => {
    const m = matrix(deriveView(payload(), noFilters()), "tokens");
    expect(m.get("lap")?.get("Claude:claude-opus-4-5")).toBe(1_010_000);
    expect(m.get("desk")?.get("Codex:gpt-5-codex")).toBe(2_000_000);
  });
});
