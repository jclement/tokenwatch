import { useStats } from "../data";
import { GlassCard, StatCard, SectionTitle } from "../components/ui";
import { HourlyBars } from "../components/charts";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, hourLabel } from "../../shared/format";

export function NightOwl() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.hourly.every((h) => h.cost === 0)) return <EmptyState seed={seed} />;

  const total = stats.hourly.reduce((s, h) => s + h.cost, 0) || 1;
  const afterMidnight = stats.hourly.filter((h) => h.hour < 6).reduce((s, h) => s + h.cost, 0);
  const share = afterMidnight / total;
  const peak = stats.hourly.reduce((a, b) => (b.cost > a.cost ? b : a));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <StatCard title="After-midnight spend" value={`${Math.round(share * 100)}%`} subtitle={sarcasm.nightOwlVerdict(share, seed)} accent="coral" />
        <StatCard title="Peak hour" value={hourLabel(peak.hour)} subtitle={`${fmtMoney(peak.cost)} burned at this hour, historically.`} accent="cyan" />
      </div>
      <GlassCard>
        <SectionTitle title="Cost by hour of day" subtitle={sarcasm.nightOwl(seed)} />
        <div className="mt-3">
          <HourlyBars buckets={stats.hourly} metric="cost" />
        </div>
        <p className="mt-2 text-[11px] text-faint">Red bars are the hours you should have been asleep (before 6am, after 10pm).</p>
      </GlassCard>
    </div>
  );
}
