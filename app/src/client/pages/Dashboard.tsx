import { Link } from "react-router-dom";
import { useStats } from "../data";
import { useView } from "../filters";
import { GlassCard, StatCard, SectionTitle } from "../components/ui";
import { WhereItWent } from "../components/WhereItWent";
import { StackCard } from "../components/StackCard";
import { NothingChecked, Sparkline, fmtMetric } from "../components/viz";
import { Loading, EmptyState } from "../components/state";
import { sarcasm, quotes } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";
import type { Slice } from "../view";

export function Dashboard() {
  const { loading, seed } = useStats();
  const v = useView();
  if (!v && loading) return <Loading />;
  if (!v || v.stats.timeline.length === 0) return <EmptyState seed={seed} />;
  const { view, palette, metric } = v;

  const g = view.grandTotals;
  const readShare = g.input + g.cacheRead > 0 ? g.cacheRead / (g.input + g.cacheRead) : 0;
  const busiest = view.days.reduce<{ day: number; cost: number } | null>(
    (best, p) => (!best || p.cost > best.cost ? { day: p.day, cost: p.cost } : best),
    null,
  );
  const last30 = view.days.slice(-30);

  return (
    <div className="space-y-5">
      <GlassCard className="border-l-2 !border-l-mint/40">
        <p className="text-[14px] italic text-subtle">“{quotes[Math.abs(seed) % quotes.length]}”</p>
      </GlassCard>

      {view.days.length === 0 ? (
        <NothingChecked />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Total Damage" value={fmtMoney(view.grandCost)} subtitle={sarcasm.verdict(view.grandCost, seed)} accent="mint" glow>
              <div className="mt-3 opacity-80" title="Last 30 active days">
                <Sparkline values={last30.map((d) => d.cost)} color="#66f2bd" />
              </div>
            </StatCard>
            <StatCard title="Total Tokens" value={fmtTokens(totalTokens(g))} subtitle={sarcasm.tokenQuip(totalTokens(g), seed)} accent="cyan">
              <div className="mt-3 opacity-80" title="Last 30 active days">
                <Sparkline values={last30.map((d) => totalTokens(d.tokens))} color="#5cc7fa" />
              </div>
            </StatCard>
            <StatCard title="Output Tokens" value={fmtTokens(g.output)} subtitle={sarcasm.outputQuip(seed)} accent="coral" />
            <StatCard title="Active Days" value={`${view.activeDays}`} subtitle={sarcasm.activeDaysQuip(seed)} accent="amber" />
          </div>

          <StackCard view={view} palette={palette} metric={metric} subtitle={sarcasm.dayQuip(busiest, seed)} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionTitle title="Where it went" subtitle={sarcasm.cacheQuip(readShare, seed)} />
              <WhereItWent t={g} />
            </GlassCard>

            <GlassCard>
              <SectionTitle title="Engine standings" subtitle={sarcasm.engineStandings(seed)} />
              <MiniRanking slices={view.byEngine} color={palette.color} metric={metric} />
            </GlassCard>

            <GlassCard>
              <div className="flex items-baseline">
                <SectionTitle title="Top models" />
                <Link to="/by-model" className="ml-auto text-[12px] text-mint/80 hover:text-mint">
                  All models →
                </Link>
              </div>
              <MiniRanking slices={view.byModel.slice(0, 6)} color={palette.color} metric={metric} />
            </GlassCard>

            <GlassCard>
              <div className="flex items-baseline">
                <SectionTitle title="Machines" />
                <Link to="/by-machine" className="ml-auto text-[12px] text-mint/80 hover:text-mint">
                  Per machine →
                </Link>
              </div>
              <MiniRanking slices={view.byMachine} color={(k) => palette.color(`machine:${k}`)} metric={metric} />
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}

// Ranked rows with cost AND tokens; the bar follows the chosen metric.
function MiniRanking({
  slices,
  color,
  metric,
}: {
  slices: Slice[];
  color: (k: string) => string;
  metric: "cost" | "tokens";
}) {
  const val = (s: Slice) => (metric === "cost" ? s.cost : totalTokens(s.tokens));
  const max = Math.max(0, ...slices.map(val)) || 1;
  if (slices.length === 0) return <div className="mt-3 text-[12px] text-faint">Nothing here yet.</div>;
  return (
    <div className="mt-3 space-y-3">
      {slices.map((s) => (
        <div key={s.key}>
          <div className="flex items-baseline gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 self-center rounded-sm" style={{ background: color(s.key) }} />
            <span className="min-w-0 truncate text-ink" title={s.label}>
              {s.label}
            </span>
            <span className="ml-auto font-bold tabular-nums">{fmtMoney(s.cost)}</span>
            <span className="w-16 text-right text-[12px] tabular-nums text-subtle">{fmtTokens(totalTokens(s.tokens))}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5" title={`${fmtMetric(val(s), metric)}`}>
            <div className="h-full rounded-full" style={{ width: `${(val(s) / max) * 100}%`, background: color(s.key) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
