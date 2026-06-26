import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { GlassCard, StatCard, SectionTitle, Button, COLORS } from "../components/ui";
import { Loading } from "../components/state";
import { fmtMoney, fmtTokens } from "../../shared/format";
import type { GroupDetail } from "../../shared/types";

type Detail = GroupDetail & { inviteCode?: string };

export function GroupDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const [g, setG] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.group(slug).then(setG).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div className="text-[13px] text-coral">{error}</div>;
  if (!g) return <Loading />;

  const inviteUrl = g.inviteCode ? `${location.origin}/groups?invite=${g.inviteCode}` : null;

  async function copyInvite() {
    if (!g?.inviteCode) return;
    await navigator.clipboard.writeText(g.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function leave() {
    if (!slug) return;
    if (!confirm("Leave this group?")) return;
    await api.leaveGroup(slug);
    nav("/groups");
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{g.name}</h1>
          <p className="text-[12px] text-faint">{g.memberCount} members</p>
        </div>
        <div className="ml-auto flex gap-2">
          {g.inviteCode && (
            <Button onClick={copyInvite}>{copied ? "Copied!" : "Copy invite code"}</Button>
          )}
          <Button variant="danger" onClick={leave}>Leave</Button>
        </div>
      </div>

      {inviteUrl && (
        <GlassCard>
          <div className="text-[12px] text-subtle">
            Share this code so friends can join: <span className="font-mono text-mint">{g.inviteCode}</span>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Group damage" value={fmtMoney(g.totalCost)} subtitle="Combined sticker price across all members." accent="mint" glow />
        <StatCard title="Group tokens" value={fmtTokens(g.totalTokens)} subtitle="Collective context consumed." accent="cyan" />
      </div>

      <GlassCard>
        <SectionTitle title="Leaderboard" subtitle="Ranked by total damage. Bragging rights are non-refundable." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Member</th>
                <th className="py-2 pr-2 text-right">Damage</th>
                <th className="py-2 pr-2 text-right">Tokens</th>
                <th className="hidden py-2 pr-2 text-right sm:table-cell">Streak</th>
                <th className="hidden py-2 pr-2 text-right sm:table-cell">🤬</th>
                <th className="hidden py-2 text-right sm:table-cell">🙏</th>
              </tr>
            </thead>
            <tbody>
              {g.leaderboard.map((row, i) => (
                <tr key={row.user.id} className="border-t border-white/5">
                  <td className="py-2 pr-2">{medals[i] ?? i + 1}</td>
                  <td className="py-2 pr-2">
                    <Link to={`/groups/${g.slug}/members/${row.user.id}`} className="flex items-center gap-2 hover:text-mint">
                      <Avatar user={row.user} />
                      <span className="font-medium underline-offset-2 hover:underline">
                        {row.user.displayName ?? row.user.username}
                      </span>
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-right font-bold tabular-nums" style={{ color: COLORS.mint }}>{fmtMoney(row.cost)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-subtle">{fmtTokens(row.tokens)}</td>
                  <td className="hidden py-2 pr-2 text-right tabular-nums text-subtle sm:table-cell">{row.currentStreak}d</td>
                  <td className="hidden py-2 pr-2 text-right tabular-nums text-subtle sm:table-cell">{row.swears}</td>
                  <td className="hidden py-2 text-right tabular-nums text-subtle sm:table-cell">{row.polite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function Avatar({ user }: { user: { username: string; displayName: string | null; avatarUrl: string | null } }) {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />;
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-mint">
      {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
    </span>
  );
}
