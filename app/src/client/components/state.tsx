import { Link } from "react-router-dom";
import { GlassCard, Spinner } from "./ui";
import { useStats } from "../data";
import { sarcasm } from "../../shared/sarcasm";

export function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="!h-7 !w-7" />
    </div>
  );
}

// Shown when a page has nothing to draw. If the stats fetch failed, that is
// what the user needs to know — not an invitation to pair an agent.
export function EmptyState({ seed }: { seed: number }) {
  const { stats, error, refresh } = useStats();
  if (error && !stats) {
    return (
      <GlassCard padding="p-10">
        <div role="alert" className="flex flex-col items-center gap-3 text-center">
          <p className="max-w-sm text-[15px] text-subtle">Couldn't load your stats.</p>
          <p className="text-[12px] text-faint">{error}</p>
          <button
            onClick={() => void refresh()}
            className="text-[13px] text-mint underline underline-offset-2 hover:text-mint/80"
          >
            Try again
          </button>
        </div>
      </GlassCard>
    );
  }
  return (
    <GlassCard padding="p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-4xl opacity-40">🌙</div>
        <p className="max-w-sm text-[15px] text-subtle">{sarcasm.emptyState(seed)}</p>
        <p className="text-[12px] text-faint">
          Pair the TokenWatch agent in{" "}
          <Link to="/settings" className="text-mint underline underline-offset-2 hover:text-mint/80">
            Settings
          </Link>{" "}
          to start syncing.
        </p>
      </div>
    </GlassCard>
  );
}
