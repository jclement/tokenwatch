// Recompute every dashboard view from the per-user events ledger. Ported from
// the Swift Database.swift aggregation queries; cost math uses shared pricing.

import {
  costOf,
  addTotals,
  emptyTotals,
  totalTokens,
  type Engine,
  type TokenTotals,
} from "../../shared/pricing";
import type {
  StatsPayload,
  DayPoint,
  BreakdownRow,
  HourBucket,
  SessionAgg,
  StreakInfo,
  TextTotals,
} from "../../shared/types";

const DAY = 86_400;

interface DemRow {
  day: number;
  engine: string;
  model: string;
  input: number;
  cache_read: number;
  cache_create: number;
  output: number;
}

const totalsOf = (r: {
  input: number;
  cache_read: number;
  cache_create: number;
  output: number;
}): TokenTotals => ({
  input: r.input,
  cacheRead: r.cache_read,
  cacheCreate: r.cache_create,
  output: r.output,
});

// All per-(day,engine,model) buckets for a user — the base for most views.
async function demRows(db: D1Database, userId: string): Promise<DemRow[]> {
  const res = await db
    .prepare(
      `SELECT day, engine, model,
              SUM(input) AS input, SUM(cache_read) AS cache_read,
              SUM(cache_create) AS cache_create, SUM(output) AS output
       FROM events WHERE user_id = ? GROUP BY day, engine, model`,
    )
    .bind(userId)
    .all<DemRow>();
  return res.results ?? [];
}

function buildTimeline(rows: DemRow[]): DayPoint[] {
  const byDay = new Map<number, { t: TokenTotals; cost: number }>();
  for (const r of rows) {
    const t = totalsOf(r);
    const cost = costOf(t, r.model, r.engine as Engine);
    const cur = byDay.get(r.day) ?? { t: emptyTotals(), cost: 0 };
    cur.t = addTotals(cur.t, t);
    cur.cost += cost;
    byDay.set(r.day, cur);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, v]) => ({ day, tokens: v.t, cost: v.cost }));
}

function buildBreakdown(rows: DemRow[], by: "model" | "engine"): BreakdownRow[] {
  const map = new Map<string, { engine: Engine; t: TokenTotals; cost: number }>();
  for (const r of rows) {
    const engine = r.engine as Engine;
    const key = by === "model" ? r.model : engine;
    const t = totalsOf(r);
    const cost = costOf(t, r.model, engine);
    const cur = map.get(key) ?? { engine, t: emptyTotals(), cost: 0 };
    cur.t = addTotals(cur.t, t);
    cur.cost += cost;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, engine: v.engine, tokens: v.t, cost: v.cost }))
    .sort((a, b) => b.cost - a.cost);
}

async function buildHourly(db: D1Database, userId: string): Promise<HourBucket[]> {
  const res = await db
    .prepare(
      `SELECT hour, engine, model,
              SUM(input) AS input, SUM(cache_read) AS cache_read,
              SUM(cache_create) AS cache_create, SUM(output) AS output
       FROM events WHERE user_id = ? AND hour BETWEEN 0 AND 23
       GROUP BY hour, engine, model`,
    )
    .bind(userId)
    .all<DemRow & { hour: number }>();
  const cost = new Array(24).fill(0);
  const toks = new Array(24).fill(0);
  for (const r of res.results ?? []) {
    const t = totalsOf(r);
    cost[r.hour] += costOf(t, r.model, r.engine as Engine);
    toks[r.hour] += totalTokens(t);
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, cost: cost[h], tokens: toks[h] }));
}

interface SessRow extends DemRow {
  session: string;
  start: number;
  end: number;
  msgs: number;
}

async function buildSessions(db: D1Database, userId: string, limit = 15): Promise<SessionAgg[]> {
  const res = await db
    .prepare(
      `SELECT session, engine, model, MIN(ts) AS start, MAX(ts) AS end, COUNT(*) AS msgs,
              SUM(input) AS input, SUM(cache_read) AS cache_read,
              SUM(cache_create) AS cache_create, SUM(output) AS output
       FROM events WHERE user_id = ? AND session != '' AND ts > 0
       GROUP BY session, engine, model`,
    )
    .bind(userId)
    .all<SessRow>();

  interface Acc {
    engine: Engine;
    model: string;
    t: TokenTotals;
    cost: number;
    start: number;
    end: number;
    msgs: number;
  }
  const bySession = new Map<string, Acc>();
  for (const r of res.results ?? []) {
    const engine = r.engine as Engine;
    const t = totalsOf(r);
    const a =
      bySession.get(r.session) ??
      ({ engine, model: r.model, t: emptyTotals(), cost: 0, start: r.start, end: r.end, msgs: 0 } as Acc);
    a.t = addTotals(a.t, t);
    a.cost += costOf(t, r.model, engine);
    a.start = Math.min(a.start, r.start);
    a.end = Math.max(a.end, r.end);
    a.msgs += r.msgs;
    if (totalTokens(t) > a.t.output) a.model = r.model; // dominant model labels the session
    bySession.set(r.session, a);
  }
  return [...bySession.entries()]
    .map(([id, a]) => ({
      id,
      engine: a.engine,
      model: a.model,
      start: a.start,
      end: a.end,
      tokens: a.t,
      cost: a.cost,
      messages: a.msgs,
    }))
    .sort((x, y) => y.cost - x.cost)
    .slice(0, limit);
}

export function computeStreak(days: number[]): StreakInfo {
  if (days.length === 0) return { longest: 0, current: 0, longestStart: null, longestEnd: null };
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  let runStart = sorted[0];
  let bestStart = sorted[0];
  let bestEnd = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === DAY) {
      run++;
    } else {
      run = 1;
      runStart = sorted[i];
    }
    if (run > longest) {
      longest = run;
      bestStart = runStart;
      bestEnd = sorted[i];
    }
  }
  // current streak: must reach today or yesterday (in local-ish day terms)
  const last = sorted[sorted.length - 1];
  const todayStart = Math.floor(Date.now() / 1000 / DAY) * DAY;
  let current = 0;
  if (last >= todayStart - DAY) {
    current = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      if (sorted[i] - sorted[i - 1] === DAY) current++;
      else break;
    }
  }
  return { longest, current, longestStart: bestStart, longestEnd: bestEnd };
}

async function buildText(db: D1Database, userId: string): Promise<TextTotals> {
  const res = await db
    .prepare(
      `SELECT COALESCE(SUM(swears),0) AS swears, COALESCE(SUM(polite),0) AS polite,
              COALESCE(SUM(agreed),0) AS agreed, COALESCE(SUM(sorry),0) AS sorry
       FROM text_stats WHERE user_id = ?`,
    )
    .bind(userId)
    .first<TextTotals>();
  return res ?? { swears: 0, polite: 0, agreed: 0, sorry: 0 };
}

async function buildTopSwears(db: D1Database, userId: string, limit = 12) {
  const res = await db
    .prepare(
      `SELECT word, SUM(n) AS count FROM word_hits WHERE user_id = ?
       GROUP BY word ORDER BY count DESC LIMIT ?`,
    )
    .bind(userId, limit)
    .all<{ word: string; count: number }>();
  return res.results ?? [];
}

export async function personalStats(db: D1Database, userId: string): Promise<StatsPayload> {
  const rows = await demRows(db, userId);
  const timeline = buildTimeline(rows);

  let grand = emptyTotals();
  let grandCost = 0;
  for (const p of timeline) {
    grand = addTotals(grand, p.tokens);
    grandCost += p.cost;
  }

  const meta = await db
    .prepare(`SELECT COUNT(*) AS messages, MIN(day) AS earliest FROM events WHERE user_id = ?`)
    .bind(userId)
    .first<{ messages: number; earliest: number | null }>();

  const [hourly, topSessions, text, topSwears] = await Promise.all([
    buildHourly(db, userId),
    buildSessions(db, userId),
    buildText(db, userId),
    buildTopSwears(db, userId),
  ]);

  return {
    grandTotals: grand,
    grandCost,
    activeDays: timeline.length,
    messages: meta?.messages ?? 0,
    historyStart: meta?.earliest ?? null,
    timeline,
    byModel: buildBreakdown(rows, "model"),
    byEngine: buildBreakdown(rows, "engine"),
    hourly,
    topSessions,
    streak: computeStreak(timeline.map((p) => p.day)),
    heatmap: timeline.map((p) => ({ day: p.day, cost: p.cost })),
    text,
    topSwears,
  };
}

// Per-user rollup for a group leaderboard, over an explicit set of users.
export interface UserRollup {
  userId: string;
  cost: number;
  tokens: number;
  activeDays: number;
  currentStreak: number;
  swears: number;
  polite: number;
  sycophancy: number;
}

export async function groupRollups(db: D1Database, userIds: string[]): Promise<UserRollup[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => "?").join(",");

  // Per-(user,engine,model) token sums → cost in TS.
  const dem = await db
    .prepare(
      `SELECT user_id, engine, model,
              SUM(input) AS input, SUM(cache_read) AS cache_read,
              SUM(cache_create) AS cache_create, SUM(output) AS output
       FROM events WHERE user_id IN (${placeholders}) GROUP BY user_id, engine, model`,
    )
    .bind(...userIds)
    .all<DemRow & { user_id: string }>();

  // Distinct active days per user (for activeDays + streak).
  const daysRes = await db
    .prepare(
      `SELECT user_id, day FROM events WHERE user_id IN (${placeholders})
       GROUP BY user_id, day`,
    )
    .bind(...userIds)
    .all<{ user_id: string; day: number }>();

  const textRes = await db
    .prepare(
      `SELECT user_id, COALESCE(SUM(swears),0) AS swears, COALESCE(SUM(polite),0) AS polite,
              COALESCE(SUM(agreed),0) AS agreed
       FROM text_stats WHERE user_id IN (${placeholders}) GROUP BY user_id`,
    )
    .bind(...userIds)
    .all<{ user_id: string; swears: number; polite: number; agreed: number }>();

  const roll = new Map<string, UserRollup>();
  const ensure = (id: string): UserRollup => {
    let r = roll.get(id);
    if (!r) {
      r = { userId: id, cost: 0, tokens: 0, activeDays: 0, currentStreak: 0, swears: 0, polite: 0, sycophancy: 0 };
      roll.set(id, r);
    }
    return r;
  };
  for (const id of userIds) ensure(id);

  for (const r of dem.results ?? []) {
    const t = totalsOf(r);
    const acc = ensure(r.user_id);
    acc.cost += costOf(t, r.model, r.engine as Engine);
    acc.tokens += totalTokens(t);
  }

  const daysByUser = new Map<string, number[]>();
  for (const r of daysRes.results ?? []) {
    const arr = daysByUser.get(r.user_id) ?? [];
    arr.push(r.day);
    daysByUser.set(r.user_id, arr);
  }
  for (const [id, days] of daysByUser) {
    const acc = ensure(id);
    acc.activeDays = days.length;
    acc.currentStreak = computeStreak(days).current;
  }

  for (const r of textRes.results ?? []) {
    const acc = ensure(r.user_id);
    acc.swears = r.swears;
    acc.polite = r.polite;
    acc.sycophancy = r.agreed;
  }

  return [...roll.values()];
}
