import { useStats } from "../data";
import { GlassCard, StatCard, SectionTitle, COLORS } from "../components/ui";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtInt } from "../../shared/format";

export function Confessional() {
  const { stats, loading, seed } = useStats();
  if (!stats && loading) return <Loading />;
  if (!stats) return <EmptyState seed={seed} />;

  const t = stats.text;
  const nothing = t.swears + t.polite + t.agreed + t.sorry === 0;
  const maxSwear = Math.max(1, ...stats.topSwears.map((s) => s.count));

  return (
    <div className="space-y-5">
      <GlassCard className="border-l-2 !border-l-coral/40">
        <p className="text-[13px] italic text-subtle">{sarcasm.confessional(seed)}</p>
      </GlassCard>

      {nothing ? (
        <EmptyState seed={seed} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Profanity" value={fmtInt(t.swears)} subtitle={sarcasm.swearVerdict(t.swears, seed)} accent="coral" />
            <StatCard title="Pleases & Thanks" value={fmtInt(t.polite)} subtitle="Manners, logged for posterity." accent="mint" />
            <StatCard title="'You're absolutely right'" value={fmtInt(t.agreed)} subtitle={sarcasm.sycophancy(t.agreed, seed)} accent="amber" />
            <StatCard title="Model apologies" value={fmtInt(t.sorry)} subtitle="Times it said sorry. It wasn't." accent="cyan" />
          </div>

          {stats.topSwears.length > 0 && (
            <GlassCard>
              <SectionTitle title="The sweariest words" subtitle="Only counts ever leave your machine — never the messages." />
              <div className="mt-4 space-y-2">
                {stats.topSwears.map((s) => (
                  <div key={s.word} className="flex items-center gap-3 text-[13px]">
                    <span className="w-24 truncate font-mono text-coral">{s.word}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full" style={{ width: `${(s.count / maxSwear) * 100}%`, background: COLORS.coral }} />
                    </div>
                    <span className="w-12 text-right tabular-nums text-faint">{s.count}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
