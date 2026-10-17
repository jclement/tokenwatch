import { useStats } from "../data";
import { useView } from "../filters";
import { GlassCard, SectionTitle } from "../components/ui";
import { StackCard } from "../components/StackCard";
import { CumulativeLine, NothingChecked, fmtMetric } from "../components/viz";
import { Loading, EmptyState } from "../components/state";
import { sarcasm } from "../../shared/sarcasm";
import { fmtMoney, fmtTokens, shortDay } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

export function OverTime() {
  const { loading, seed } = useStats();
  const v = useView();
  if (!v && loading) return <Loading />;
  if (!v || v.stats.timeline.length === 0) return <EmptyState seed={seed} />;
  const { view, palette, metric } = v;
  if (view.days.length === 0) return <NothingChecked />;

  const val = (p: (typeof view.days)[number]) => (metric === "cost" ? p.cost : totalTokens(p.tokens));
  const recent = [...view.days].reverse().slice(0, 30);
  const max = Math.max(...view.days.map(val)) || 1;

  // Weekday rhythm: average of the chosen metric per active weekday.
  const wd = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const p of view.days) {
    const d = new Date(p.day * 1000).getUTCDay();
    wd[d].sum += val(p);
    wd[d].n++;
  }
  const wdAvg = wd.map((w) => (w.n ? w.sum / w.n : 0));
  const wdMax = Math.max(...wdAvg) || 1;

  return (
    <div className="space-y-5">
      <StackCard view={view} palette={palette} metric={metric} title="The timeline" subtitle={sarcasm.overTime(seed)} height={300} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <SectionTitle title="Running total" subtitle="Every day adds to the pile. The pile never shrinks." />
          <div className="mt-3">
            <CumulativeLine points={view.days.map((p) => ({ day: p.day, value: val(p) }))} metric={metric} />
          </div>
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Weekday rhythm" subtitle="Average per active day." />
          <div className="mt-4 flex h-[180px] items-end gap-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${fmtMetric(wdAvg[i], metric)} avg`}>
                <div
                  className="w-full rounded-t-[4px]"
                  style={{
                    height: `${(wdAvg[i] / wdMax) * 100}%`,
                    minHeight: wdAvg[i] > 0 ? 2 : 0,
                    background: i === 0 || i === 6 ? "var(--color-coral)" : "var(--color-cyan)",
                    opacity: 0.85,
                  }}
                />
                <span className="text-[11px] text-faint">{l}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">Coral is the weekend. You know what you did.</p>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionTitle title="Day by day" subtitle="The last 30 days you bothered the model." />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-faint">
                <th className="px-2 py-2 text-left font-medium">Day</th>
                <th className="w-[40%] px-2 py-2" />
                <th className="px-2 py-2 text-right font-medium">Cost</th>
                <th className="px-2 py-2 text-right font-medium">Tokens</th>
                <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Output</th>
                <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Cache R</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.day} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-2 py-1.5 text-subtle">{shortDay(p.day)}</td>
                  <td className="px-2 py-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(val(p) / max) * 100}%`,
                          background: "linear-gradient(90deg, var(--color-cyan), var(--color-mint))",
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtMoney(p.cost)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-subtle">{fmtTokens(totalTokens(p.tokens))}</td>
                  <td className="hidden px-2 py-1.5 text-right tabular-nums text-faint md:table-cell">{fmtTokens(p.tokens.output)}</td>
                  <td className="hidden px-2 py-1.5 text-right tabular-nums text-faint md:table-cell">{fmtTokens(p.tokens.cacheRead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
