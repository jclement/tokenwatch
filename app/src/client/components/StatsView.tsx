import { GlassCard, StatCard, SectionTitle, COLORS } from "./ui";
import { SpendArea } from "./charts";
import { WhereItWent } from "./WhereItWent";
import { fmtMoney, fmtTokens } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";
import type { PublicStats } from "../../shared/types";

// The read-only stats body shared by the public /s/<token> page and the
// members-only group member-detail page.
export function PublicStatsView({ data }: { data: PublicStats }) {
  const g = data.grandTotals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Total Damage" value={fmtMoney(data.grandCost)} accent="mint" glow />
        <StatCard title="Total Tokens" value={fmtTokens(totalTokens(g))} accent="cyan" />
        <StatCard title="Active Days" value={`${data.activeDays}`} accent="amber" />
        <StatCard title="Longest Streak" value={`${data.streak.longest}d`} accent="coral" />
      </div>

      {data.timeline.length > 0 && (
        <GlassCard>
          <SectionTitle title="Spending, day by day" />
          <div className="mt-3">
            <SpendArea points={data.timeline} />
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Where it went" />
          <WhereItWent t={g} />
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Top models" />
          <div className="mt-3 space-y-2.5">
            {data.byModel.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-[13px]">
                <span className="truncate" style={{ color: r.engine === "Claude" ? COLORS.amber : COLORS.cyan }}>
                  {r.label}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{fmtMoney(r.cost)}</span>
              </div>
            ))}
            {data.byModel.length === 0 && <div className="text-[12px] text-faint">No models yet.</div>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
