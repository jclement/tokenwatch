import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { GlassCard, SectionTitle, Button, Spinner } from "../components/ui";
import { Loading } from "../components/state";
import type { Group } from "../../shared/types";

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.groups().then((r) => setGroups(r.groups)).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.createGroup(name.trim());
      setName("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await api.joinGroup(invite.trim());
      setInvite("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!groups) return <Loading />;

  return (
    <div className="space-y-5">
      {error && <div className="text-[13px] text-coral">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Create a group" subtitle="Invite friends and compete over poor financial decisions." />
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Token Burners"
              className="flex-1 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[14px] outline-none focus:border-mint/50"
            />
            <Button variant="primary" disabled={busy || name.trim().length < 2} onClick={create}>
              {busy ? <Spinner /> : "Create"}
            </Button>
          </div>
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Join a group" subtitle="Paste an invite code a friend shared." />
          <div className="mt-3 flex gap-2">
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="invite code"
              className="flex-1 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[14px] outline-none focus:border-mint/50"
            />
            <Button disabled={busy || invite.trim().length < 4} onClick={join}>
              Join
            </Button>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionTitle title="Your groups" />
        {groups.length === 0 ? (
          <p className="mt-3 text-[13px] text-faint">No groups yet. Create one or join with an invite.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.slug}`}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]"
              >
                <span className="text-lg">👥</span>
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">{g.name}</div>
                  <div className="text-[11px] text-faint">{g.memberCount} member{g.memberCount === 1 ? "" : "s"}</div>
                </div>
                <span className="text-faint">→</span>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
