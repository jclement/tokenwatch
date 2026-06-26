import { useStats } from "../data";
import { GlassCard, SectionTitle } from "../components/ui";
import { Loading, EmptyState } from "../components/state";
import { FactCard } from "./Perspective";
import { sarcasm } from "../../shared/sarcasm";
import { ecoFacts, acresRainforest, n } from "../../shared/funfacts";
import { totalTokens } from "../../shared/pricing";

export function Environmental() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.timeline.length === 0) return <EmptyState seed={seed} />;

  const tokens = totalTokens(stats.grandTotals);
  const facts = ecoFacts(tokens);
  const acres = acresRainforest(tokens);

  return (
    <div className="space-y-5">
      <GlassCard>
        <SectionTitle title="The Earth's invoice" subtitle={sarcasm.environmental(seed)} />
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-4xl font-extrabold text-lime tabular-nums">{n(acres)}</span>
          <span className="text-[15px] text-subtle">acres of rainforest, carbon-wise</span>
        </div>
        <p className="mt-2 text-[12px] italic text-faint">{sarcasm.environmental(seed + 1)}</p>
      </GlassCard>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <FactCard key={f.unit} f={f} />
        ))}
      </div>
      <p className="text-center text-[11px] text-faint">
        Constants are satirical-but-plausible (~1.5 Wh / 1k tokens). Do not cite in an actual sustainability report.
      </p>
    </div>
  );
}
