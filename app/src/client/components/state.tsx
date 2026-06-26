import { Link } from "react-router-dom";
import { GlassCard, Spinner } from "./ui";
import { sarcasm } from "../../shared/sarcasm";

export function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="!h-7 !w-7" />
    </div>
  );
}

export function EmptyState({ seed }: { seed: number }) {
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
