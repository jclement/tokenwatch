import { useStats } from "../data";
import { GlassCard, SectionTitle, COLORS } from "../components/ui";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

export function ByModel() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats || stats.byModel.length === 0) return <EmptyState seed={seed} />;

  const max = Math.max(...stats.byModel.map((r) => r.cost));
  return (
    <GlassCard>
      <SectionTitle title="Model leaderboard" subtitle={sarcasm.byModel(seed)} />
      <div className="mt-4 space-y-3">
        {stats.byModel.map((r, i) => (
          <div key={r.label}>
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className="w-5 text-faint">{i + 1}</span>
              <span className="truncate font-medium" style={{ color: r.engine === "Claude" ? COLORS.amber : COLORS.cyan }}>
                {r.label}
              </span>
              <span className="ml-auto font-bold tabular-nums">{fmtMoney(r.cost)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.cost / max) * 100}%`, background: r.engine === "Claude" ? COLORS.amber : COLORS.cyan }}
                />
              </div>
              <span className="w-20 text-right text-[11px] text-faint">{fmtTokens(totalTokens(r.tokens))}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
