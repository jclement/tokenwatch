import { useStats } from "../data";
import { GlassCard, SectionTitle, COLORS } from "../components/ui";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens, fmtDuration, shortDayTime } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

export function HallOfFame() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.topSessions.length === 0) return <EmptyState seed={seed} />;

  return (
    <GlassCard>
      <SectionTitle title="Hall of Fame" subtitle={sarcasm.hallOfFame(seed)} />
      <div className="mt-4 space-y-2">
        {stats.topSessions.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <span className="w-6 text-center text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold" style={{ color: s.engine === "Claude" ? COLORS.amber : COLORS.cyan }}>
                {s.model}
              </div>
              <div className="truncate text-[11px] text-faint">
                {shortDayTime(s.start)} · {fmtDuration(Math.max(0, s.end - s.start))} · {s.messages} msgs · {fmtTokens(totalTokens(s.tokens))} tokens
              </div>
            </div>
            <div className="text-right font-bold tabular-nums">{fmtMoney(s.cost)}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
