import { useStats } from "../data";
import { useView } from "../filters";
import { GlassCard, SectionTitle } from "../components/ui";
import { StackCard } from "../components/StackCard";
import { BreakdownTable, Donut, NothingChecked } from "../components/viz";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";

export function ByEngine() {
  const { loading, seed } = useStats();
  const v = useView();
  if (!v && loading) return <Loading />;
  if (!v || v.stats.byEngine.length === 0) return <EmptyState seed={seed} />;
  const { view, palette, metric } = v;
  if (view.byEngine.length === 0) return <NothingChecked />;

  return (
    <div className="space-y-5">
      <GlassCard>
        <SectionTitle title="Claude vs Codex" subtitle={sarcasm.byEngine(seed)} />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Donut slices={view.byEngine} metric="cost" color={palette.color} caption="Cost" />
          <Donut slices={view.byEngine} metric="tokens" color={palette.color} caption="Tokens" />
        </div>
        <div className="mt-4">
          <BreakdownTable slices={view.byEngine} color={palette.color} name="Engine" />
        </div>
      </GlassCard>
      <StackCard view={view} palette={palette} metric={metric} initial="engine" />
    </div>
  );
}
