import { describe, it, expect } from "vitest";
import { costOf, rateFor, isLocalModel, totalTokens } from "./pricing";

describe("pricing", () => {
  it("prices each token class at its own rate", () => {
    const t = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheCreate: 1_000_000 };
    // claude-opus: input 5, output 25, cacheRead 0.5, cacheCreate 6.25
    expect(costOf(t, "claude-opus-4", "Claude")).toBeCloseTo(5 + 25 + 0.5 + 6.25, 6);
  });

  it("matches model substrings to rates", () => {
    expect(rateFor("claude-sonnet-4-6", "Claude").output).toBe(15);
    expect(rateFor("gpt-5", "Codex").output).toBe(10);
  });

  it("charges nothing for local models", () => {
    expect(isLocalModel("qwen2.5-coder")).toBe(true);
    expect(costOf({ input: 5_000_000, output: 5_000_000, cacheRead: 0, cacheCreate: 0 }, "llama-3", "Claude")).toBe(0);
  });

  it("sums token totals", () => {
    expect(totalTokens({ input: 1, output: 2, cacheRead: 3, cacheCreate: 4 })).toBe(10);
  });
});
