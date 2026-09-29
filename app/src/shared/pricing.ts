// Per-million-token sticker prices. Ported verbatim from the Swift app's
// Pricing.swift. Anthropic rates are authoritative; OpenAI/Codex are estimates.
// Costs are STICKER PRICE — retail value of the tokens at à-la-carte API rates.

export type Engine = "Claude" | "Codex";

export interface ModelRate {
  input: number; // $/MTok fresh input
  output: number; // $/MTok output
  cacheRead: number; // $/MTok cache reads
  cacheCreate: number; // $/MTok cache writes, 5-minute TTL
  cacheCreate1h: number; // $/MTok cache writes, 1-hour TTL
}

export interface TokenTotals {
  input: number;
  cacheRead: number;
  cacheCreate: number; // all cache writes, both TTLs
  cacheCreate1h: number; // the 1-hour-TTL subset of cacheCreate, billed higher
  output: number;
}

export const emptyTotals = (): TokenTotals => ({
  input: 0,
  cacheRead: 0,
  cacheCreate: 0,
  cacheCreate1h: 0,
  output: 0,
});

// cacheCreate1h is a subset of cacheCreate, so it is not added again.
export const totalTokens = (t: TokenTotals): number =>
  t.input + t.cacheRead + t.cacheCreate + t.output;

export const addTotals = (a: TokenTotals, b: TokenTotals): TokenTotals => ({
  input: a.input + b.input,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheCreate: a.cacheCreate + b.cacheCreate,
  cacheCreate1h: a.cacheCreate1h + b.cacheCreate1h,
  output: a.output + b.output,
});

interface RateEntry {
  match: string;
  engine: Engine;
  rate: ModelRate;
}

// Anthropic cache writes: 5-minute TTL is 1.25x input, 1-hour TTL is 2x input.
const claude = (input: number, output: number): ModelRate => ({
  input,
  output,
  cacheRead: input * 0.1,
  cacheCreate: input * 1.25,
  cacheCreate1h: input * 2,
});

// OpenAI has no separate cache-write charge.
const openai = (input: number, output: number, cacheRead: number): ModelRate => ({
  input,
  output,
  cacheRead,
  cacheCreate: 0,
  cacheCreate1h: 0,
});

// First substring match wins, so specific ids precede their families.
const TABLE: RateEntry[] = [
  // ---- Claude ----
  { match: "claude-fable-5", engine: "Claude", rate: claude(10, 50) },
  { match: "claude-mythos", engine: "Claude", rate: claude(10, 50) },
  { match: "claude-opus-4-1", engine: "Claude", rate: claude(15, 75) },
  { match: "claude-opus-4-2025", engine: "Claude", rate: claude(15, 75) }, // Opus 4.0 (dated id)
  { match: "claude-opus", engine: "Claude", rate: claude(5, 25) },
  { match: "claude-sonnet", engine: "Claude", rate: claude(3, 15) },
  { match: "claude-haiku", engine: "Claude", rate: claude(1, 5) },
  { match: "claude-3-opus", engine: "Claude", rate: claude(15, 75) },
  { match: "claude-3-5-sonnet", engine: "Claude", rate: claude(3, 15) },
  { match: "claude-3-7-sonnet", engine: "Claude", rate: claude(3, 15) },
  { match: "claude-3-5-haiku", engine: "Claude", rate: claude(0.8, 4) },
  { match: "claude-3-haiku", engine: "Claude", rate: claude(0.25, 1.25) },
  // ---- Codex / OpenAI (estimates) ----
  { match: "gpt-5.5", engine: "Codex", rate: openai(1.75, 14, 0.175) },
  { match: "gpt-5", engine: "Codex", rate: openai(1.25, 10, 0.125) },
  { match: "o4", engine: "Codex", rate: openai(1.1, 4.4, 0.275) },
  { match: "gpt-4.1", engine: "Codex", rate: openai(2.0, 8, 0.5) },
  { match: "gpt-4o", engine: "Codex", rate: openai(2.5, 10, 1.25) },
];

const FALLBACK: Record<Engine, ModelRate> = {
  Claude: claude(5, 25),
  Codex: openai(1.25, 10, 0.125),
};

// Local models routed through Claude Code (Ollama, etc.) cost nothing.
const LOCAL_MARKERS = [
  "gemma", "qwen", "llama", "mistral", "deepseek",
  "phi", "codestral", "ollama", "granite", "gpt-oss",
];

export const isLocalModel = (model: string): boolean => {
  const m = model.toLowerCase();
  return LOCAL_MARKERS.some((marker) => m.includes(marker));
};

export const rateFor = (model: string, engine: Engine): ModelRate => {
  if (isLocalModel(model)) return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, cacheCreate1h: 0 };
  const m = model.toLowerCase();
  for (const entry of TABLE) {
    if (entry.engine === engine && m.includes(entry.match)) return entry.rate;
  }
  return FALLBACK[engine];
};

// Dollars, the honest way: each token class at its own rate. Cache writes
// split by TTL; data from agents that predate the split has cacheCreate1h = 0
// and is priced entirely at the 5-minute rate.
export const costOf = (t: TokenTotals, model: string, engine: Engine): number => {
  const r = rateFor(model, engine);
  const create1h = Math.min(t.cacheCreate1h, t.cacheCreate);
  return (
    (t.input / 1_000_000) * r.input +
    (t.output / 1_000_000) * r.output +
    (t.cacheRead / 1_000_000) * r.cacheRead +
    ((t.cacheCreate - create1h) / 1_000_000) * r.cacheCreate +
    (create1h / 1_000_000) * r.cacheCreate1h
  );
};
