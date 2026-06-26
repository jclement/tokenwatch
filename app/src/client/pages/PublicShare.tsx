import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { GlassCard, StatCard, SectionTitle, LegendDot, COLORS, Spinner } from "../components/ui";
import { SpendArea, TokenSplitBar } from "../components/charts";
import { fmtMoney, fmtTokens } from "../../shared/format";
import { totalTokens } from "../../shared/pricing";
import type { PublicStats } from "../../shared/types";

export function PublicShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.publicStats(token).then(setData).catch(() => setError("This share link is no longer active."));
  }, [token]);

  if (error) {
    return (
      <Centered>
        <GlassCard padding="p-8">
          <div className="text-center">
            <div className="mb-2 text-4xl">🔒</div>
            <p className="text-[15px] text-subtle">{error}</p>
            <Link to="/" className="mt-4 inline-block text-[13px] text-mint underline">
              Go to TokenWatch →
            </Link>
          </div>
        </GlassCard>
      </Centered>
    );
  }

  if (!data) {
    return (
      <Centered>
        <Spinner className="!h-8 !w-8" />
      </Centered>
    );
  }

  const g = data.grandTotals;
  const name = data.user.displayName ?? data.user.username;

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Avatar user={data.user} />
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{name}’s token damage</h1>
            <p className="mt-1 text-[13px] text-faint">
              {data.messages.toLocaleString()} messages · since{" "}
              {data.historyStart
                ? new Date(data.historyStart * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "—"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard title="Total Damage" value={fmtMoney(data.grandCost)} accent="mint" glow />
          <StatCard title="Total Tokens" value={fmtTokens(totalTokens(g))} accent="cyan" />
          <StatCard title="Active Days" value={`${data.activeDays}`} accent="amber" />
          <StatCard title="Longest Streak" value={`${data.streak.longest}d`} accent="coral" />
        </div>

        {data.timeline.length > 0 && (
          <GlassCard className="mt-4">
            <SectionTitle title="Spending, day by day" />
            <div className="mt-3">
              <SpendArea points={data.timeline} />
            </div>
          </GlassCard>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard>
            <SectionTitle title="Where it went" />
            <div className="my-4">
              <TokenSplitBar t={g} />
            </div>
            <div className="space-y-2.5">
              <LegendDot color={COLORS.cyan} label="Fresh input" value={fmtTokens(g.input)} />
              <LegendDot color={COLORS.amber} label="Cache writes" value={fmtTokens(g.cacheCreate)} />
              <LegendDot color={COLORS.lime} label="Cache reads" value={fmtTokens(g.cacheRead)} />
              <LegendDot color={COLORS.coral} label="Output" value={fmtTokens(g.output)} />
            </div>
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

        {/* CTA footer */}
        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-5 py-2.5 text-[14px] font-semibold text-mint transition hover:bg-mint/20"
          >
            🔥 Track your own with TokenWatch
          </Link>
          <p className="mt-3 text-[11px] text-faint">Sticker-price totals from Claude Code &amp; Codex usage.</p>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6">{children}</div>;
}

function Avatar({ user }: { user: PublicStats["user"] }) {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />;
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-bold text-mint">
      {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
    </div>
  );
}
