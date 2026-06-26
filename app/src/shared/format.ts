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

export function shortDay(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
