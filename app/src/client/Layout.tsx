import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { NAV } from "./nav";
import { useAuth } from "./auth";
import { useStats } from "./data";
import { api } from "./api";
import { sarcasm } from "../shared/sarcasm";
import { fmtInt } from "../shared/format";
import { Spinner, Banner } from "./components/ui";
import type { VersionInfo } from "../shared/types";

export function Layout({ children }: { children: ReactNode }) {
  const { seed } = useStats();
  return (
    <div className="flex h-full">
      <Sidebar seed={seed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header seed={seed} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ seed }: { seed: number }) {
  const personal = NAV.filter((n) => n.group === "personal");
  const social = NAV.filter((n) => n.group === "social");
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-white/[0.06] bg-bg2/40">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-6">
        <span className="text-xl">🔥</span>
        <div>
          <div className="text-[17px] font-extrabold leading-none money-gradient">TokenWatch</div>
          <div className="mt-0.5 text-[10px] text-faint">still judging you</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {personal.map((n) => (
          <NavItemLink key={n.to} {...n} />
        ))}
        <div className="px-3 pb-1 pt-4 text-[10px] uppercase tracking-wider text-faint">Social</div>
        {social.map((n) => (
          <NavItemLink key={n.to} {...n} />
        ))}
      </nav>
      <div className="p-4 text-[11px] italic leading-snug text-faint">{sarcasm.tagline(seed)}</div>
    </aside>
  );
}

function NavItemLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-medium transition ${
          isActive ? "bg-white/[0.05] text-ink" : "text-subtle hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-mint" />}
          <span className="w-5 text-center">{icon}</span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function Header({ seed }: { seed: number }) {
  const { user, logout } = useAuth();
  const { stats, loading, refresh } = useStats();
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    void api.version().then(setVersion).catch(() => {});
  }, []);

  const statusLine = (() => {
    if (loading && !stats) return "Booting up the guilt machine…";
    if (!stats) return "";
    const parts = [`${fmtInt(stats.messages)} messages archived`];
    if (stats.historyStart) parts.push(`history since ${new Date(stats.historyStart * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
    parts.push(`${stats.activeDays} active days`);
    return parts.join(" · ");
  })();

  return (
    <header className="border-b border-white/[0.06] bg-bg/40">
      {version?.workerStale && (
        <div className="px-6 pt-3">
          <Banner tone="amber">
            A newer TokenWatch ({version.latestRelease}) is out — this server is on {version.worker}. Time to redeploy.
          </Banner>
        </div>
      )}
      {version?.agentStale && (
        <div className="px-6 pt-3">
          <Banner tone="coral">
            Your ingestion agent is out of date. Run <code className="font-mono">tokenwatch --upgrade</code> to get {version.agentLatest}.
          </Banner>
        </div>
      )}
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="min-w-0">
          <div className="truncate text-[20px] font-bold">{sarcasm.headerTitle(seed)}</div>
          <div className="truncate text-[12px] text-subtle">{statusLine}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="glass inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {loading ? <Spinner /> : <span>↻</span>}
            {loading ? "Counting…" : sarcasm.refreshButton(seed)}
          </button>
          <button
            onClick={() => void logout()}
            title={`Signed in as ${user?.username}`}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-[13px] font-bold text-mint"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.displayName ?? user?.username ?? "?").slice(0, 1).toUpperCase()
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
