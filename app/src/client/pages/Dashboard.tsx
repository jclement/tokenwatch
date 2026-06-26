import { useStats } from "../data";
import { GlassCard, StatCard, SectionTitle, LegendDot, COLORS } from "../components/ui";
import { SpendArea, TokenSplitBar } from "../components/charts";
import { Loading, EmptyState } from "../components/state";
import { sarcasm, quotes } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

export function Dashboard() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats) return <EmptyState seed={seed} />;

  const g = stats.grandTotals;
  const empty = stats.timeline.length === 0;
  const readShare = g.input + g.cacheRead > 0 ? g.cacheRead / (g.input + g.cacheRead) : 0;
  const busiest = stats.timeline.reduce<{ day: number; cost: number } | null>(
    (best, p) => (!best || p.cost > best.cost ? { day: p.day, cost: p.cost } : best),
    null,
  );

  return (
    <div className="space-y-5">
      <GlassCard className="border-l-2 !border-l-mint/40">
        <p className="text-[14px] italic text-subtle">“{quotes[Math.abs(seed) % quotes.length]}”</p>
      </GlassCard>

      {empty ? (
        <EmptyState seed={seed} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Total Damage" value={fmtMoney(stats.grandCost)} subtitle={sarcasm.verdict(stats.grandCost, seed)} accent="mint" glow />
            <StatCard title="Total Tokens" value={fmtTokens(totalTokens(g))} subtitle={sarcasm.tokenQuip(totalTokens(g), seed)} accent="cyan" />
            <StatCard title="Output Tokens" value={fmtTokens(g.output)} subtitle={sarcasm.outputQuip(seed)} accent="coral" />
            <StatCard title="Active Days" value={`${stats.activeDays}`} subtitle={sarcasm.activeDaysQuip(seed)} accent="amber" />
          </div>

          <GlassCard>
            <SectionTitle title="Spending, day by day" subtitle={sarcasm.dayQuip(busiest, seed)} />
            <div className="mt-3">
              <SpendArea points={stats.timeline} />
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Where it went" subtitle={sarcasm.cacheQuip(readShare, seed)} />
              <div className="my-4">
                <TokenSplitBar t={g} />
              </div>
              <div className="space-y-2.5">
                <LegendDot color={COLORS.cyan} label="Fresh input" value={fmtTokens(g.input)} />
                <LegendDot color={COLORS.amber} label="Cache writes" value={fmtTokens(g.cacheCreate)} />
                <LegendDot color={COLORS.lime} label="Cache reads" value={fmtTokens(g.cacheRead)} />
                <LegendDot color={COLORS.coral} label="Output" value={fmtTokens(g.output)} />
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Engine standings" subtitle={sarcasm.engineStandings(seed)} />
              <div className="mt-3 space-y-3">
                {stats.byEngine.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center">
                      <LegendDot color={row.engine === "Claude" ? COLORS.amber : COLORS.cyan} label={row.engine} />
                      <span className="ml-auto font-bold tabular-nums">{fmtMoney(row.cost)}</span>
                    </div>
                    <div className="text-[11px] text-faint">{fmtTokens(totalTokens(row.tokens))} tokens</div>
                  </div>
                ))}
                {stats.byEngine.length === 0 && <div className="text-[12px] text-faint">No engines yet.</div>}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
