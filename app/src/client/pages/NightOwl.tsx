import { useStats } from "../data";
import { useView } from "../filters";
import { NothingChecked } from "../components/viz";
import { GlassCard, StatCard, SectionTitle } from "../components/ui";
import { HourlyBars } from "../components/charts";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens, hourLabel } from "../../shared/format";

export function NightOwl() {
  const { stats, loading, seed } = useStats();
  const v = useView();
  if (!stats && loading) return <Loading />;
  if (!stats || !v || stats.hourly.every((h) => h.cost === 0)) return <EmptyState seed={seed} />;
  const { view, metric } = v;
  const hourly = view.hourly;
  if (hourly.every((h) => h.tokens === 0)) return <NothingChecked />;

  const total = hourly.reduce((s, h) => s + h[metric], 0) || 1;
  const afterMidnight = hourly.filter((h) => h.hour < 6).reduce((s, h) => s + h[metric], 0);
  const share = afterMidnight / total;
  const peak = hourly.reduce((a, b) => (b[metric] > a[metric] ? b : a));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <StatCard title={metric === "cost" ? "After-midnight spend" : "After-midnight tokens"} value={`${Math.round(share * 100)}%`} subtitle={sarcasm.nightOwlVerdict(share, seed)} accent="coral" />
        <StatCard title="Peak hour" value={hourLabel(peak.hour)} subtitle={`${fmtMoney(peak.cost)} and ${fmtTokens(peak.tokens)} tokens burned at this hour, historically.`} accent="cyan" />
      </div>
      <GlassCard>
        <SectionTitle title={`${metric === "cost" ? "Cost" : "Tokens"} by hour of day`} subtitle={sarcasm.nightOwl(seed)} />
        <div className="mt-3">
          <HourlyBars buckets={hourly} metric={metric} />
        </div>
        <p className="mt-2 text-[11px] text-faint">Red bars are the hours you should have been asleep (before 6am, after 10pm).</p>
      </GlassCard>
    </div>
  );
}
