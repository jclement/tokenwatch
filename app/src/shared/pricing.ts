// Per-million-token sticker prices. Ported verbatim from the Swift app's
// Pricing.swift. Anthropic rates are authoritative; OpenAI/Codex are estimates.
// Costs are STICKER PRICE — retail value of the tokens at à-la-carte API rates.

export type Engine = "Claude" | "Codex";

export interface ModelRate {
  input: number; // $/MTok fresh input
  output: number; // $/MTok output
  cacheRead: number; // $/MTok cache reads
  cacheCreate: number; // $/MTok cache writes
}

export interface TokenTotals {
  input: number;
  cacheRead: number;
  cacheCreate: number;
  output: number;
}

export const emptyTotals = (): TokenTotals => ({
  input: 0,
  cacheRead: 0,
  cacheCreate: 0,
  output: 0,
});

export const totalTokens = (t: TokenTotals): number =>
  t.input + t.cacheRead + t.cacheCreate + t.output;

export const addTotals = (a: TokenTotals, b: TokenTotals): TokenTotals => ({
  input: a.input + b.input,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheCreate: a.cacheCreate + b.cacheCreate,
  output: a.output + b.output,
});

interface RateEntry {
  match: string;
  engine: Engine;
  rate: ModelRate;
}

const TABLE: RateEntry[] = [
  // ---- Claude ----
  { match: "claude-fable-5", engine: "Claude", rate: { input: 10, output: 50, cacheRead: 1.0, cacheCreate: 12.5 } },
  { match: "claude-mythos", engine: "Claude", rate: { input: 10, output: 50, cacheRead: 1.0, cacheCreate: 12.5 } },
  { match: "claude-opus", engine: "Claude", rate: { input: 5, output: 25, cacheRead: 0.5, cacheCreate: 6.25 } },
  { match: "claude-sonnet", engine: "Claude", rate: { input: 3, output: 15, cacheRead: 0.3, cacheCreate: 3.75 } },
  { match: "claude-haiku", engine: "Claude", rate: { input: 1, output: 5, cacheRead: 0.1, cacheCreate: 1.25 } },
  { match: "claude-3-opus", engine: "Claude", rate: { input: 15, output: 75, cacheRead: 1.5, cacheCreate: 18.75 } },
  // ---- Codex / OpenAI (estimates) ----
  { match: "gpt-5.5", engine: "Codex", rate: { input: 1.75, output: 14, cacheRead: 0.175, cacheCreate: 0 } },
  { match: "gpt-5", engine: "Codex", rate: { input: 1.25, output: 10, cacheRead: 0.125, cacheCreate: 0 } },
  { match: "o4", engine: "Codex", rate: { input: 1.1, output: 4.4, cacheRead: 0.275, cacheCreate: 0 } },
  { match: "gpt-4.1", engine: "Codex", rate: { input: 2.0, output: 8, cacheRead: 0.5, cacheCreate: 0 } },
  { match: "gpt-4o", engine: "Codex", rate: { input: 2.5, output: 10, cacheRead: 1.25, cacheCreate: 0 } },
];

const FALLBACK: Record<Engine, ModelRate> = {
  Claude: { input: 5, output: 25, cacheRead: 0.5, cacheCreate: 6.25 },
  Codex: { input: 1.25, output: 10, cacheRead: 0.125, cacheCreate: 0 },
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
  if (isLocalModel(model)) return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  const m = model.toLowerCase();
  for (const entry of TABLE) {
    if (entry.engine === engine && m.includes(entry.match)) return entry.rate;
  }
  return FALLBACK[engine];
};

// Dollars, the honest way: each token class at its own rate.
export const costOf = (t: TokenTotals, model: string, engine: Engine): number => {
  const r = rateFor(model, engine);
  return (
    (t.input / 1_000_000) * r.input +
    (t.output / 1_000_000) * r.output +
    (t.cacheRead / 1_000_000) * r.cacheRead +
    (t.cacheCreate / 1_000_000) * r.cacheCreate
  );
};
