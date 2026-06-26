import { useStats } from "../data";
import { GlassCard, SectionTitle, LegendDot, COLORS } from "../components/ui";
import { SpendArea } from "../components/charts";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens, shortDay } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

export function OverTime() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.timeline.length === 0) return <EmptyState seed={seed} />;

  const recent = [...stats.timeline].reverse().slice(0, 30);
  return (
    <div className="space-y-5">
      <GlassCard>
        <SectionTitle title="The timeline" subtitle={sarcasm.overTime(seed)} />
        <div className="mt-3">
          <SpendArea points={stats.timeline} />
        </div>
      </GlassCard>
      <GlassCard>
        <SectionTitle title="Day by day" subtitle="The last 30 days you bothered the model." />
        <div className="mt-3 space-y-1">
          {recent.map((p) => (
            <div key={p.day} className="flex items-center gap-3 border-b border-white/5 py-1.5 text-[13px] last:border-0">
              <span className="w-16 text-subtle">{shortDay(p.day)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-mint"
                  style={{ width: `${Math.min(100, (p.cost / Math.max(...stats.timeline.map((x) => x.cost))) * 100)}%` }}
                />
              </div>
              <span className="w-20 text-right font-semibold tabular-nums">{fmtMoney(p.cost)}</span>
              <span className="hidden w-20 text-right text-faint sm:inline">{fmtTokens(totalTokens(p.tokens))}</span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <LegendDot color={COLORS.mint} label="Daily cost" />
        </div>
      </GlassCard>
    </div>
  );
}
