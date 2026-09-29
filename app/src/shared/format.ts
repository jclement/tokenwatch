// Display formatters — ported from Theme.swift.

export function fmtMoney(v: number): string {
  const maxFrac = v >= 100 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: maxFrac === 0 ? 0 : 2,
  }).format(v);
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return `${s}s`;
}

// Day keys from the worker are UTC midnight of a calendar date, so they are
// formatted in UTC; the viewer's own timezone would shift them a day.
export function shortDay(dayKey: number): string {
  return new Date(dayKey * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "Sep 2026" for a day key.
export function monthYear(dayKey: number): string {
  return new Date(dayKey * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Today's date in the viewer's timezone, as a day key.
export function todayKey(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 1000;
}

export function shortDayTime(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "11p", "2a" — friendly hour labels for the clock.
export function hourLabel(h: number): string {
  const am = h < 12;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${am ? "a" : "p"}`;
}
