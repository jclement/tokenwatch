import { useStats } from "../data";
import { GlassCard, StatCard, SectionTitle, COLORS } from "../components/ui";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, shortDay } from "../../shared/format";

const DAY = 86_400;

export function Streaks() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.heatmap.length === 0) return <EmptyState seed={seed} />;

  const costByDay = new Map(stats.heatmap.map((h) => [h.day, h.cost]));
  const max = Math.max(...stats.heatmap.map((h) => h.cost), 0.01);

  // 26-week grid ending today.
  const todayStart = Math.floor(Date.now() / 1000 / DAY) * DAY;
  const weeks = 26;
  const cells: { day: number; cost: number }[] = [];
  const start = todayStart - (weeks * 7 - 1) * DAY;
  for (let i = 0; i < weeks * 7; i++) {
    const day = start + i * DAY;
    cells.push({ day, cost: costByDay.get(day) ?? 0 });
  }
  // arrange into columns of 7 (weeks)
  const columns: { day: number; cost: number }[][] = [];
  for (let w = 0; w < weeks; w++) columns.push(cells.slice(w * 7, w * 7 + 7));

  const intensity = (cost: number) => {
    if (cost <= 0) return "rgba(255,255,255,0.05)";
    const r = Math.min(1, cost / max);
    return `rgba(102,242,189,${0.2 + r * 0.8})`;
  };

  const s = stats.streak;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Longest streak" value={`${s.longest} days`} subtitle={sarcasm.streakVerdict(s.longest, seed)} accent="amber" />
        <StatCard title="Current streak" value={`${s.current} days`} subtitle={s.current > 0 ? "Still going. Touch grass eventually." : "Streak's dead. The model waits patiently."} accent="mint" />
      </div>
      <GlassCard>
        <SectionTitle title="Contribution heatmap" subtitle={sarcasm.streaks(seed)} />
        <div className="mt-4 flex gap-[3px] overflow-x-auto pb-2">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => (
                <div
                  key={cell.day}
                  title={`${shortDay(cell.day)} — ${fmtMoney(cell.cost)}`}
                  className="h-3 w-3 rounded-[3px]"
                  style={{ background: intensity(cell.cost) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
          <span>Less</span>
          <span className="h-3 w-3 rounded-[3px]" style={{ background: "rgba(255,255,255,0.05)" }} />
          <span className="h-3 w-3 rounded-[3px]" style={{ background: "rgba(102,242,189,0.4)" }} />
          <span className="h-3 w-3 rounded-[3px]" style={{ background: COLORS.mint }} />
          <span>More</span>
        </div>
      </GlassCard>
    </div>
  );
}
