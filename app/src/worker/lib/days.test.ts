import { describe, it, expect } from "vitest";
import { dayKey, earliestTodayKey, DAY } from "./days";

const SEP29 = Date.UTC(2026, 8, 29) / 1000;
const H = 3600;

describe("dayKey", () => {
  it("maps local midnights across timezones to the same calendar date", () => {
    expect(dayKey(SEP29 + 6 * H)).toBe(SEP29); // Calgary, MDT (UTC-6)
    expect(dayKey(SEP29 + 10 * H)).toBe(SEP29); // Honolulu (UTC-10)
    expect(dayKey(SEP29 - 10 * H)).toBe(SEP29); // Sydney (UTC+10)
    expect(dayKey(SEP29 - 13 * H)).toBe(SEP29); // Auckland, NZDT (UTC+13)
  });

  it("is idempotent on keys it already produced", () => {
    expect(dayKey(SEP29)).toBe(SEP29);
  });

  it("keeps days on either side of a DST change exactly one day apart", () => {
    // Calgary: Nov 1 local midnight is MDT (UTC-6), Nov 2 is MST (UTC-7).
    const nov1 = Date.UTC(2026, 10, 1) / 1000;
    expect(dayKey(nov1 + DAY + 7 * H) - dayKey(nov1 + 6 * H)).toBe(DAY);
  });
});

describe("earliestTodayKey", () => {
  it("is today's date in UTC-12", () => {
    expect(earliestTodayKey((SEP29 + 11 * H) * 1000)).toBe(SEP29 - DAY);
    expect(earliestTodayKey((SEP29 + 13 * H) * 1000)).toBe(SEP29);
  });
});
