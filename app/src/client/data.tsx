import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "./api";
import type { StatsPayload } from "../shared/types";

const POLL_MS = 20_000;

interface StatsState {
  stats: StatsPayload | null;
  loading: boolean;
  error: string | null;
  seed: number; // re-rolls the sarcasm pools on manual refresh
  lastUpdated: number | null; // epoch ms of last successful fetch
  justUpdated: boolean; // briefly true right after a live auto-update
  refresh: (reseed?: boolean) => Promise<void>;
}

const Ctx = createContext<StatsState | null>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const cursorRef = useRef<number | null>(null);
  const requestRef = useRef(0); // only the newest request may commit its result

  // `reseed` marks a user-initiated load: it shows the loading state and
  // re-rolls the sarcasm. Live auto-updates pass false and refresh silently.
  const refresh = useCallback(async (reseed = true) => {
    const req = ++requestRef.current;
    if (reseed) setLoading(true);
    try {
      const s = await api.stats();
      if (req !== requestRef.current) return;
      setStats(s);
      setError(null);
      if (reseed) setSeed(Math.floor(Math.random() * 100000));
      setLastUpdated(Date.now());
    } catch (e) {
      if (req !== requestRef.current) return;
      setError((e as Error).message);
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, []);

  // Initial load, then capture the liveness baseline.
  useEffect(() => {
    void (async () => {
      await refresh(true);
      try {
        const { lastIngestAt } = await api.statsCursor();
        cursorRef.current = lastIngestAt;
      } catch {
        /* ignore */
      }
    })();
  }, [refresh]);

  // Live updates: poll the cheap cursor; refetch full stats only when the
  // agent has pushed something new. Pause while the tab is hidden, and check
  // immediately when it regains focus.
  useEffect(() => {
    const check = async () => {
      if (document.hidden) return;
      try {
        const { lastIngestAt } = await api.statsCursor();
        // A null baseline (its first fetch failed) is just adopted, not
        // treated as new data — the initial load already fetched stats.
        if (cursorRef.current === null) {
          cursorRef.current = lastIngestAt;
        } else if (lastIngestAt !== null && lastIngestAt !== cursorRef.current) {
          cursorRef.current = lastIngestAt;
          await refresh(false); // new data — refetch without re-rolling sarcasm
          setJustUpdated(true);
          window.setTimeout(() => setJustUpdated(false), 2500);
        }
      } catch {
        /* offline / transient — try again next tick */
      }
    };
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ stats, loading, error, seed, lastUpdated, justUpdated, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStats(): StatsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStats outside StatsProvider");
  return v;
}
