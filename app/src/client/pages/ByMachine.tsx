import { useStats } from "../data";
import { useView } from "../filters";
import { GlassCard, SectionTitle, Banner } from "../components/ui";
import { StackCard } from "../components/StackCard";
import { BreakdownTable, Donut, Heatmap, NothingChecked, Sparkline } from "../components/viz";
import { Loading, EmptyState } from "../components/state";
import { matrix } from "../view";
import { fmtMoney, fmtTokens, shortDayTime } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";

const OS: Record<string, string> = { darwin: "macOS", linux: "Linux", windows: "Windows" };

export function ByMachine() {
  const { loading, seed } = useStats();
  const v = useView();
  if (!v && loading) return <Loading />;
  if (!v || v.stats.timeline.length === 0) return <EmptyState seed={seed} />;
  const { view, palette, metric, stats } = v;
  if (view.byMachine.length === 0) return <NothingChecked />;

  const mColor = (k: string) => palette.color(`machine:${k}`);
  const unattributed = view.byMachine.find((m) => m.key === "");
  const totalCost = view.grandCost || 1;

  // Last 30 calendar days per machine, for the card sparklines.
  const end = view.days.length ? view.days[view.days.length - 1].day : 0;
  const start = end - 29 * 86400;
  const spark = new Map<string, number[]>();
  for (const c of view.cells) {
    if (c.day < start) continue;
    const arr = spark.get(c.machine) ?? new Array(30).fill(0);
    arr[Math.round((c.day - start) / 86400)] += metric === "cost" ? c.cost : totalTokens(c.tokens);
    spark.set(c.machine, arr);
  }

  const grid = matrix(view, metric);
  const machineRows = view.byMachine.map((m) => ({ key: m.key, label: m.label }));
  const modelCols = view.byModel.slice(0, 8).map((m) => ({ key: m.key, label: m.label }));

  return (
    <div className="space-y-5">
      {unattributed && (
        <Banner tone="amber">
          {fmtMoney(unattributed.cost)} ({fmtTokens(totalTokens(unattributed.tokens))} tokens) was synced before TokenWatch
          recorded which key sent it, so it shows as <span className="font-semibold">Unattributed</span>. Each machine
          re-sends its history once after upgrading to agent 0.4.0 or later, and those rows move to that key's machine.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {view.byMachine.map((m) => {
          const info = m.machine;
          const col = mColor(m.key);
          return (
            <GlassCard key={m.key} className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl"
                style={{ background: col }}
              />
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: col, boxShadow: `0 0 10px ${col}` }} />
                <span className="truncate text-[15px] font-bold text-ink">{m.label}</span>
                <span className="ml-auto text-[11px] tabular-nums text-faint">{((m.cost / totalCost) * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-0.5 text-[11px] text-faint">
                {info?.platform ? `${OS[info.platform] ?? info.platform} · ${info.arch ?? "?"}` : info?.removed ? "unpaired" : "no machine recorded"}
                {info?.lastSeenAt ? ` · seen ${shortDayTime(info.lastSeenAt)}` : ""}
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-2xl font-extrabold tabular-nums text-ink">{fmtMoney(m.cost)}</span>
                <span className="text-[13px] tabular-nums text-subtle">{fmtTokens(totalTokens(m.tokens))} tokens</span>
              </div>
              <div className="mt-2">
                <Sparkline values={spark.get(m.key) ?? []} color={col} />
              </div>
            </GlassCard>
          );
        })}
      </div>

      <StackCard view={view} palette={palette} metric={metric} initial="machine" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-2">
          <SectionTitle title="Split of the bill" />
          <div className="mt-2 grid grid-cols-2 gap-1">
            <Donut slices={view.byMachine} metric="cost" color={mColor} caption="Cost" />
            <Donut slices={view.byMachine} metric="tokens" color={mColor} caption="Tokens" />
          </div>
        </GlassCard>
        <GlassCard className="lg:col-span-3">
          <SectionTitle
            title={`Machine × model (${metric === "cost" ? "cost" : "tokens"})`}
            subtitle="Which box runs which brain. Brighter is more."
          />
          <div className="mt-3">
            <Heatmap rows={machineRows} cols={modelCols} metric={metric} value={(r, c) => grid.get(r)?.get(c) ?? 0} />
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionTitle title="Machine ledger" subtitle={`${stats.cube.machines.length} machines on file.`} />
        <div className="mt-3">
          <BreakdownTable slices={view.byMachine} color={mColor} name="Machine" />
        </div>
      </GlassCard>
    </div>
  );
}
