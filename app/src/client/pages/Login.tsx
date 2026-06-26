import { useState } from "react";
import { useAuth } from "../auth";
import { GlassCard, Button, Spinner } from "../components/ui";
import { sarcasm } from "../../shared/sarcasm";

export function LoginPage() {
  const { register, login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seed = 7;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🔥</div>
          <h1 className="text-2xl font-extrabold money-gradient">TokenWatch</h1>
          <p className="mt-1 text-[13px] italic text-faint">{sarcasm.tagline(seed)}</p>
        </div>
        <GlassCard padding="p-6">
          {mode === "register" && (
            <label className="mb-3 block">
              <span className="mb-1 block text-[12px] text-subtle">Pick a username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nightowl"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[14px] outline-none focus:border-mint/50"
              />
            </label>
          )}

          {error && <div className="mb-3 text-[12px] text-coral">{error}</div>}

          <Button
            variant="primary"
            className="w-full"
            disabled={busy || (mode === "register" && username.trim().length < 3)}
            onClick={() =>
              run(mode === "register" ? () => register(username.trim()) : () => login())
            }
          >
            {busy ? <Spinner /> : mode === "register" ? "Create account with passkey" : "Sign in with passkey"}
          </Button>

          <button
            className="mt-4 w-full text-center text-[12px] text-subtle hover:text-ink"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setError(null);
            }}
          >
            {mode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </GlassCard>
        <p className="mt-4 text-center text-[11px] text-faint">
          No passwords. Just passkeys. Your stats sync from the TokenWatch agent.
        </p>
      </div>
    </div>
  );
}
