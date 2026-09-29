// The wire contract shared by the worker API, the React client, and (mirrored)
// the Go agent. Everything here is sanitized: numeric stats and opaque ids only.

import type { Engine, TokenTotals } from "./pricing";

// ---- Ingest (agent → worker) ------------------------------------------------

// One billed message, sanitized. `id` is the stable dedup key:
//   Claude assistant turn → message.id
//   Claude user turn       → one-way FNV hash of timestamp+text (irreversible)
//   Codex                  → "codex:<file>:<ordinal>"
// `session` is a UUID (Claude) or bare rollout filename (Codex) — never a path.
export interface IngestEvent {
  id: string;
  ts: number; // epoch seconds
  // Agent-local midnight as epoch seconds. The worker stores it as a calendar
  // date key (see dayKey in the ingest route), not as this instant.
  day: number;
  hour: number; // local hour 0-23, or -1 if unknown
  session: string;
  engine: Engine;
  model: string;
  input: number;
  cacheRead: number;
  cacheCreate: number; // all cache writes
  cacheCreate1h?: number; // 1-hour-TTL subset of cacheCreate; absent from older agents
  output: number;
  // Confessional counts (fixed lexicon; no free text).
  swears: number;
  polite: number;
  agreed: number;
  sorry: number;
  // Optional per-word swear tallies — only sent when the agent runs with
  // --share-swear-words. Keys are from a closed profanity lexicon.
  swearWords?: Record<string, number>;
}

export interface IngestRequest {
  agentVersion: string;
  events: IngestEvent[];
}

export interface IngestResponse {
  received: number;
  inserted: number;
}

// ---- Aggregates (worker → client) -------------------------------------------

// Every `day` the worker returns is a calendar-date key: UTC midnight of the
// agent's local date, so format it in UTC (shortDay does) and step by 86400.
export interface DayPoint {
  day: number;
  tokens: TokenTotals;
  cost: number;
}

export interface BreakdownRow {
  label: string;
  engine: Engine;
  tokens: TokenTotals;
  cost: number;
}

export interface HourBucket {
  hour: number;
  cost: number;
  tokens: number;
}

export interface SessionAgg {
  id: string;
  engine: Engine;
  model: string;
  start: number;
  end: number;
  tokens: TokenTotals;
  cost: number;
  messages: number;
}

export interface TextTotals {
  swears: number;
  polite: number;
  agreed: number;
  sorry: number;
}

export interface StreakInfo {
  longest: number;
  current: number;
  longestStart: number | null;
  longestEnd: number | null;
}

// The full personal stats payload powering all dashboard tabs.
export interface StatsPayload {
  grandTotals: TokenTotals;
  grandCost: number;
  activeDays: number;
  messages: number;
  historyStart: number | null;
  timeline: DayPoint[];
  byModel: BreakdownRow[];
  byEngine: BreakdownRow[];
  hourly: HourBucket[];
  topSessions: SessionAgg[];
  streak: StreakInfo;
  heatmap: { day: number; cost: number }[];
  text: TextTotals;
  topSwears: { word: string; count: number }[];
}

// ---- Profile / account ------------------------------------------------------

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Me extends PublicUser {
  createdAt: number;
  agentVersion: string | null;
  lastIngestAt: number | null;
  shareToken: string | null; // public share enabled when non-null
}

// Curated, read-only stats served on the public /s/<token> page.
export interface PublicStats {
  user: PublicUser;
  grandTotals: TokenTotals;
  grandCost: number;
  activeDays: number;
  messages: number;
  historyStart: number | null;
  timeline: DayPoint[];
  byEngine: BreakdownRow[];
  byModel: BreakdownRow[];
  streak: StreakInfo;
  text: TextTotals;
}

// ---- Groups -----------------------------------------------------------------

export interface Group {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  memberCount: number;
  createdAt: number;
}

export interface LeaderboardRow {
  user: PublicUser;
  cost: number;
  tokens: number;
  activeDays: number;
  currentStreak: number;
  swears: number;
  polite: number;
  sycophancy: number;
}

export interface GroupDetail extends Group {
  members: PublicUser[];
  leaderboard: LeaderboardRow[];
  totalCost: number;
  totalTokens: number;
}

// ---- Version / staleness ----------------------------------------------------

export interface VersionInfo {
  worker: string;
  latestRelease: string | null;
  workerStale: boolean;
  agentLatest: string | null;
  agentStale: boolean; // for the signed-in user's last-seen agent
}
