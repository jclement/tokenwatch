import { useStats } from "../data";
import { GlassCard, SectionTitle, LegendDot, COLORS } from "../components/ui";
import { DonutShare } from "../components/charts";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

export function ByEngine() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.byEngine.length === 0) return <EmptyState seed={seed} />;

  const donut = stats.byEngine.map((r) => ({
    label: r.engine,
    value: r.cost,
    color: r.engine === "Claude" ? COLORS.amber : COLORS.cyan,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GlassCard>
        <SectionTitle title="Claude vs Codex" subtitle={sarcasm.byEngine(seed)} />
        <div className="mt-3">
          <DonutShare data={donut} />
        </div>
        <div className="mt-3 space-y-2">
          {stats.byEngine.map((r) => (
            <LegendDot key={r.label} color={r.engine === "Claude" ? COLORS.amber : COLORS.cyan} label={r.engine} value={fmtMoney(r.cost)} />
          ))}
        </div>
      </GlassCard>
      <div className="space-y-4">
        {stats.byEngine.map((r) => (
          <GlassCard key={r.label}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold" style={{ color: r.engine === "Claude" ? COLORS.amber : COLORS.cyan }}>
                {r.engine}
              </span>
              <span className="text-[15px] font-bold tabular-nums">{fmtMoney(r.cost)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <Stat label="Input" v={fmtTokens(r.tokens.input)} />
              <Stat label="Output" v={fmtTokens(r.tokens.output)} />
              <Stat label="Cache writes" v={fmtTokens(r.tokens.cacheCreate)} />
              <Stat label="Cache reads" v={fmtTokens(r.tokens.cacheRead)} />
            </div>
            <div className="mt-2 text-[11px] text-faint">{fmtTokens(totalTokens(r.tokens))} tokens total</div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <div className="text-faint">{label}</div>
      <div className="font-semibold tabular-nums">{v}</div>
    </div>
  );
}
