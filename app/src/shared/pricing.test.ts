import { describe, it, expect } from "vitest";
import { costOf, rateFor, isLocalModel, totalTokens, emptyTotals } from "./pricing";

const M = 1_000_000;

describe("pricing", () => {
  it("prices each token class at its own rate", () => {
    const t = { input: M, output: M, cacheRead: M, cacheCreate: M, cacheCreate1h: 0 };
    // claude-opus: input 5, output 25, cacheRead 0.5, cacheCreate 6.25
    expect(costOf(t, "claude-opus-4-6", "Claude")).toBeCloseTo(5 + 25 + 0.5 + 6.25, 6);
  });

  it("prices 1-hour cache writes at 2x input and the rest at 1.25x", () => {
    const t = { ...emptyTotals(), cacheCreate: 3 * M, cacheCreate1h: 2 * M };
    // 1M at 6.25 (5m) + 2M at 10 (1h)
    expect(costOf(t, "claude-opus-4-6", "Claude")).toBeCloseTo(6.25 + 20, 6);
  });

  it("never prices more 1-hour writes than there are writes", () => {
    const t = { ...emptyTotals(), cacheCreate: M, cacheCreate1h: 5 * M };
    expect(costOf(t, "claude-sonnet-4-6", "Claude")).toBeCloseTo(6, 6);
  });

  it("matches model substrings to rates", () => {
    expect(rateFor("claude-sonnet-4-6", "Claude").output).toBe(15);
    expect(rateFor("gpt-5", "Codex").output).toBe(10);
  });

  it("prices older models at their own rates, not the fallback", () => {
    expect(rateFor("claude-opus-4-1-20250805", "Claude").input).toBe(15);
    expect(rateFor("claude-opus-4-20250514", "Claude").input).toBe(15);
    expect(rateFor("claude-opus-4-5-20251101", "Claude").input).toBe(5);
    expect(rateFor("claude-3-5-haiku-20241022", "Claude").input).toBe(0.8);
    expect(rateFor("claude-3-7-sonnet-20250219", "Claude").input).toBe(3);
  });

  it("charges nothing for local models", () => {
    expect(isLocalModel("qwen2.5-coder")).toBe(true);
    expect(costOf({ ...emptyTotals(), input: 5 * M, output: 5 * M }, "llama-3", "Claude")).toBe(0);
  });

  it("sums token totals without double-counting the 1-hour subset", () => {
    expect(totalTokens({ input: 1, output: 2, cacheRead: 3, cacheCreate: 4, cacheCreate1h: 4 })).toBe(10);
  });
});
