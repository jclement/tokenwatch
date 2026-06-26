import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type { StatsPayload } from "../shared/types";

interface StatsState {
  stats: StatsPayload | null;
  loading: boolean;
  error: string | null;
  seed: number; // re-rolls the sarcasm pools each refresh
  refresh: () => Promise<void>;
}

const Ctx = createContext<StatsState | null>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.stats();
      setStats(s);
      setSeed(Math.floor(Math.random() * 100000));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ stats, loading, error, seed, refresh }}>{children}</Ctx.Provider>
  );
}

export function useStats(): StatsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStats outside StatsProvider");
  return v;
}
