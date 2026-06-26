import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { GlassCard, Spinner } from "../components/ui";
import { PublicStatsView } from "../components/StatsView";
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

        <PublicStatsView data={data} />

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
