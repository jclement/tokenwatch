import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  padding = "p-[18px]",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return <div className={`glass ${padding} ${className}`}>{children}</div>;
}

const ACCENTS: Record<string, string> = {
  mint: "text-mint",
  cyan: "text-cyan",
  amber: "text-amber",
  coral: "text-coral",
  lime: "text-lime",
};

export function StatCard({
  title,
  value,
  subtitle,
  accent = "mint",
  glow = false,
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent?: keyof typeof ACCENTS | string;
  glow?: boolean;
}) {
  const accentClass = ACCENTS[accent] ?? "text-mint";
  return (
    <GlassCard className={glow ? "shadow-[0_0_40px_-12px_var(--color-mint)]" : ""}>
      <div className="text-[11px] uppercase tracking-wider text-faint">{title}</div>
      <div className={`mt-1 text-3xl font-extrabold tabular-nums ${accentClass}`}>{value}</div>
      {subtitle && <div className="mt-2 text-[12px] leading-snug text-subtle">{subtitle}</div>}
    </GlassCard>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div className="text-[15px] font-bold text-ink">{title}</div>
      {subtitle && <div className="text-[12px] italic text-faint">{subtitle}</div>}
    </div>
  );
}

export function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-subtle">{label}</span>
      {value !== undefined && <span className="ml-auto font-semibold tabular-nums text-ink">{value}</span>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-mint ${className}`}
    />
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "ghost",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "primary" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-mint/15 text-mint border border-mint/30 hover:bg-mint/25"
      : variant === "danger"
        ? "bg-coral/10 text-coral border border-coral/30 hover:bg-coral/20"
        : "glass hover:bg-white/[0.07]";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function Banner({
  tone = "amber",
  children,
}: {
  tone?: "amber" | "coral" | "mint";
  children: ReactNode;
}) {
  const c =
    tone === "coral" ? "border-coral/40 text-coral" : tone === "mint" ? "border-mint/40 text-mint" : "border-amber/40 text-amber";
  return (
    <div className={`glass !rounded-xl border ${c} px-4 py-2 text-[13px]`}>{children}</div>
  );
}

export const COLORS = {
  mint: "#66f2bd",
  cyan: "#5cc7fa",
  amber: "#ffbd57",
  coral: "#ff737a",
  lime: "#b8f25c",
};
