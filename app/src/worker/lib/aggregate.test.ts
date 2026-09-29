import { describe, it, expect } from "vitest";
import { computeStreak } from "./aggregate";

const DAY = 86_400;
const day = (n: number) => n * DAY; // arbitrary day index → epoch seconds

describe("computeStreak", () => {
  it("returns zeros for no days", () => {
    expect(computeStreak([])).toEqual({ longest: 0, current: 0, longestStart: null, longestEnd: null });
  });

  it("finds the longest consecutive run", () => {
    // run of 3 (10,11,12), gap, run of 2 (20,21)
    const s = computeStreak([day(10), day(11), day(12), day(20), day(21)]);
    expect(s.longest).toBe(3);
    expect(s.longestStart).toBe(day(10));
    expect(s.longestEnd).toBe(day(12));
  });

  it("dedups and sorts unordered input", () => {
    const s = computeStreak([day(5), day(5), day(4), day(3)]);
    expect(s.longest).toBe(3);
  });

  it("has no current streak when the last day is old", () => {
    const s = computeStreak([day(1), day(2), day(3)]);
    expect(s.current).toBe(0);
  });

  it("counts a streak that ends yesterday as current", () => {
    const now = (day(100) + 15 * 3600) * 1000; // day 100, 15:00 UTC
    expect(computeStreak([day(97), day(98), day(99)], now).current).toBe(3);
    expect(computeStreak([day(97), day(98)], now).current).toBe(0);
  });
});
