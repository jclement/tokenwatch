import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { PublicStatsView } from "../components/StatsView";
import { Loading } from "../components/state";
import type { PublicStats } from "../../shared/types";

export function GroupMember() {
  const { slug, userId } = useParams<{ slug: string; userId: string }>();
  const [data, setData] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !userId) return;
    api.groupMember(slug, userId).then(setData).catch((e) => setError(e.message));
  }, [slug, userId]);

  if (error) return <div className="text-[13px] text-coral">{error}</div>;
  if (!data) return <Loading />;

  const name = data.user.displayName ?? data.user.username;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to={`/groups/${slug}`} className="text-[13px] text-subtle hover:text-ink">
          ← Back
        </Link>
        {data.user.avatarUrl ? (
          <img src={data.user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-mint">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="text-xl font-extrabold">{name}</h1>
          <p className="text-[12px] text-faint">@{data.user.username}</p>
        </div>
      </div>
      <PublicStatsView data={data} />
    </div>
  );
}
