import { useStats } from "../data";
import { GlassCard, COLORS } from "../components/ui";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { perspectiveFacts, thirdGraders, n, type FunFact } from "../../shared/funfacts";
import { totalTokens } from "../../shared/pricing";

export function Perspective() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.timeline.length === 0) return <EmptyState seed={seed} />;

  const tokens = totalTokens(stats.grandTotals);
  const facts = perspectiveFacts(tokens, stats.grandTotals.output, stats.grandCost, stats.activeDays);
  const kids = thirdGraders(tokens);

  return (
    <div className="space-y-5">
      <GlassCard className="text-center" padding="p-8">
        <div className="text-[12px] uppercase tracking-wider text-faint">{sarcasm.perspective(seed)}</div>
        <div className="mt-2 text-5xl font-extrabold money-gradient">{n(kids)}</div>
        <div className="mt-1 text-[15px] text-subtle">third-graders typing all day to match your tokens</div>
      </GlassCard>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <FactCard key={f.unit} f={f} />
        ))}
      </div>
    </div>
  );
}

export function FactCard({ f }: { f: FunFact }) {
  const color = (COLORS as Record<string, string>)[f.accent] ?? COLORS.mint;
  return (
    <GlassCard>
      <div className="text-2xl">{f.icon}</div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums" style={{ color }}>
        {f.big}
      </div>
      <div className="text-[13px] font-semibold text-subtle">{f.unit}</div>
      <div className="mt-2 text-[12px] leading-snug text-faint">{f.caption}</div>
    </GlassCard>
  );
}
