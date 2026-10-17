// Packs per-(day|hour, device, engine, model) token buckets into the compact
// StatsCube the client filters. Pure (no D1), so client tests can build one.

import { costOf, totalTokens, type Engine, type TokenTotals } from "./pricing";
import type { MachineInfo, ModelKey, StatsCube } from "./types";

interface Bucket {
  device_id: string;
  engine: string;
  model: string;
  input: number;
  cache_read: number;
  cache_create: number;
  cache_create_1h: number;
  output: number;
}

const totalsOf = (r: Bucket): TokenTotals => ({
  input: r.input,
  cacheRead: r.cache_read,
  cacheCreate: r.cache_create,
  cacheCreate1h: r.cache_create_1h,
  output: r.output,
});

export interface DeviceRow {
  id: string;
  name: string | null;
  platform: string | null;
  arch: string | null;
  last_seen_at: number | null;
}

// Pack the day and hour buckets into the compact, filterable cube. Machines are
// every device that uploaded something plus every paired device, so a fresh
// machine shows up before its first sync lands.
export function buildCube(
  rows: (Bucket & { day: number })[],
  hours: (Bucket & { hour: number })[],
  devices: DeviceRow[],
): StatsCube {
  const models: ModelKey[] = [];
  const modelIdx = new Map<string, number>();
  const mi = (engine: string, model: string) => {
    const k = `${engine}\u0000${model}`;
    let i = modelIdx.get(k);
    if (i === undefined) {
      i = models.length;
      models.push({ engine: engine as Engine, model });
      modelIdx.set(k, i);
    }
    return i;
  };
  const machines: MachineInfo[] = devices.map((d) => ({
    id: d.id,
    name: d.name || "device",
    platform: d.platform,
    arch: d.arch,
    lastSeenAt: d.last_seen_at,
    removed: false,
  }));
  const machineIdx = new Map(machines.map((m, i) => [m.id, i]));
  const di = (id: string) => {
    let i = machineIdx.get(id);
    if (i === undefined) {
      i = machines.length;
      machines.push({
        id,
        name: id === "" ? "Unattributed" : "Removed machine",
        platform: null,
        arch: null,
        lastSeenAt: null,
        removed: id !== "",
      });
      machineIdx.set(id, i);
    }
    return i;
  };
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    models,
    machines,
    rows: rows.map((r) => {
      const t = totalsOf(r);
      return [
        r.day, mi(r.engine, r.model), di(r.device_id),
        t.input, t.cacheRead, t.cacheCreate, t.cacheCreate1h, t.output,
        round(costOf(t, r.model, r.engine as Engine)),
      ];
    }),
    hourRows: hours.map((r) => {
      const t = totalsOf(r);
      return [r.hour, mi(r.engine, r.model), di(r.device_id), totalTokens(t), round(costOf(t, r.model, r.engine as Engine))];
    }),
  };
}
