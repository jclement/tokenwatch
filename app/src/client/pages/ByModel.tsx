import { useStats } from "../data";
import { useView } from "../filters";
import { GlassCard, SectionTitle } from "../components/ui";
import { StackCard } from "../components/StackCard";
import { BreakdownTable, NothingChecked, ShareCompare } from "../components/viz";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";

export function ByModel() {
  const { loading, seed } = useStats();
  const v = useView();
  if (!v && loading) return <Loading />;
  if (!v || v.stats.byModel.length === 0) return <EmptyState seed={seed} />;
  const { view, palette, metric } = v;
  if (view.byModel.length === 0) return <NothingChecked />;

  return (
    <div className="space-y-5">
      <GlassCard>
        <SectionTitle title="Model leaderboard" subtitle={sarcasm.byModel(seed)} />
        <div className="mt-4">
          <BreakdownTable
            slices={view.byModel}
            color={palette.color}
            name="Model"
            extra={(s) => <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">{s.engine}</span>}
          />
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-2">
          <SectionTitle title="Who eats the budget" subtitle="Share of the money vs share of the tokens." />
          <div className="mt-4">
            <ShareCompare slices={view.byModel.slice(0, 8)} color={palette.color} />
          </div>
        </GlassCard>
        <div className="lg:col-span-3">
          <StackCard view={view} palette={palette} metric={metric} initial="model" height={300} />
        </div>
      </div>
    </div>
  );
}
