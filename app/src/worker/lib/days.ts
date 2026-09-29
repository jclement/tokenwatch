// Day keys. The agent reports each event's day as its own local midnight, as
// epoch seconds. That instant depends on the agent's timezone and DST, so it
// can't be compared with a UTC "today" or stepped by 86400. The worker stores
// the calendar date instead, encoded as UTC midnight of that date.

export const DAY = 86_400;

// Local midnight is D - offset for the local date D. Adding 13h and flooring
// recovers D for any offset in (-11h, +13h]: all inhabited zones except
// UTC-11 and UTC+14. Already-converted keys map to themselves.
export function dayKey(localMidnight: number): number {
  return Math.floor((localMidnight + 13 * 3600) / DAY) * DAY;
}

// The latest calendar date that is "today" anywhere a streak could plausibly
// be alive: today in UTC-12. The server has no per-user timezone, so a streak
// counts as current if its last day is this date or the one before.
export function earliestTodayKey(nowMs = Date.now()): number {
  return Math.floor((nowMs / 1000 - 12 * 3600) / DAY) * DAY;
}
