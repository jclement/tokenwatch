import { useEffect, useRef, useState } from "react";
import { api, type PasskeyInfo, type DeviceInfo } from "../api";
import { useAuth } from "../auth";
import { GlassCard, SectionTitle, Button, Spinner } from "../components/ui";
import { PairingInstructions } from "../components/PairingInstructions";
import { shortDayTime } from "../../shared/format";

export function Settings() {
  return (
    <div className="space-y-5">
      <ProfileCard />
      <ShareCard />
      <DevicesCard />
      <PasskeysCard />
    </div>
  );
}

function ShareCard() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const enabled = !!user?.shareToken;
  const url = user?.shareToken ? `${location.origin}/s/${user.shareToken}` : "";

  async function toggle() {
    setBusy(true);
    try {
      if (enabled) await api.disableShare();
      else await api.enableShare();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <SectionTitle
          title="Public share page"
          subtitle="A read-only page anyone with the link can view — your headline stats, no login required."
        />
        <Button variant={enabled ? "danger" : "primary"} disabled={busy} onClick={toggle}>
          {busy ? <Spinner /> : enabled ? "Turn off" : "Turn on"}
        </Button>
      </div>
      {enabled && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1 rounded-[10px] border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] text-ink outline-none"
          />
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button>Open ↗</Button>
            </a>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function ProfileCard() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api.updateProfile({ displayName });
      await refresh();
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      await api.uploadAvatar(file);
      await refresh();
      setMsg("Avatar updated.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard>
      <SectionTitle title="Profile" subtitle="How you show up on group leaderboards." />
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-xl font-bold text-mint"
          title="Upload avatar"
        >
          {user?.avatarUrl ? (
            <img src={`${user.avatarUrl}?t=${Date.now()}`} alt="" className="h-full w-full object-cover" />
          ) : (
            (user?.displayName ?? user?.username ?? "?").slice(0, 1).toUpperCase()
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <div className="flex-1">
          <label className="text-[12px] text-subtle">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[14px] outline-none focus:border-mint/50"
          />
          <p className="mt-1 text-[11px] text-faint">@{user?.username}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" disabled={busy} onClick={save}>
          {busy ? <Spinner /> : "Save"}
        </Button>
        {msg && <span className="text-[12px] text-subtle">{msg}</span>}
      </div>
    </GlassCard>
  );
}

function DevicesCard() {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresInSec: number } | null>(null);

  const load = () => api.devices().then((r) => setDevices(r.devices)).catch(() => setDevices([]));
  useEffect(() => void load(), []);

  async function generate() {
    const p = await api.generatePairing();
    setPairing(p);
  }

  async function remove(id: string) {
    await api.removeDevice(id);
    await load();
  }

  return (
    <GlassCard>
      <SectionTitle title="Ingestion devices" subtitle="The TokenWatch agent reads your local logs and pushes sanitized stats. Raw logs never leave your machine." />

      <div className="mt-4">
        <Button variant="primary" onClick={generate}>
          + Pair a new device
        </Button>
      </div>

      {pairing && <PairingInstructions code={pairing.code} />}

      <div className="mt-4 space-y-2">
        {devices === null ? (
          <Spinner />
        ) : devices.length === 0 ? (
          <p className="text-[13px] text-faint">No devices paired yet.</p>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5 text-[13px]">
              <span className="text-lg">💻</span>
              <div className="flex-1">
                <div className="font-medium">
                  {d.name ?? "device"} {d.platform && <span className="text-faint">· {d.platform}/{d.arch}</span>}
                </div>
                <div className="text-[11px] text-faint">
                  {d.agentVersion && `v${d.agentVersion} · `}
                  {d.lastSeenAt ? `last seen ${shortDayTime(d.lastSeenAt)}` : "never synced"}
                </div>
              </div>
              <Button variant="danger" onClick={() => remove(d.id)}>Revoke</Button>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

function PasskeysCard() {
  const { addPasskey } = useAuth();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.passkeys().then((r) => setPasskeys(r.passkeys)).catch(() => setPasskeys([]));
  useEffect(() => void load(), []);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addPasskey();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.removePasskey(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <GlassCard>
      <SectionTitle title="Passkeys" subtitle="Sign in from multiple devices. Add one per laptop, phone, or hardware key." />
      <div className="mt-4">
        <Button variant="primary" disabled={busy} onClick={add}>
          {busy ? <Spinner /> : "+ Add a passkey"}
        </Button>
        {error && <span className="ml-3 text-[12px] text-coral">{error}</span>}
      </div>
      <div className="mt-4 space-y-2">
        {passkeys === null ? (
          <Spinner />
        ) : (
          passkeys.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5 text-[13px]">
              <span className="text-lg">🔑</span>
              <div className="flex-1">
                <div className="font-medium">{p.name ?? "passkey"}</div>
                <div className="text-[11px] text-faint">
                  added {shortDayTime(p.createdAt)}
                  {p.lastUsedAt ? ` · last used ${shortDayTime(p.lastUsedAt)}` : ""}
                  {p.backedUp ? " · synced" : ""}
                </div>
              </div>
              {passkeys.length > 1 && (
                <Button variant="danger" onClick={() => remove(p.id)}>Remove</Button>
              )}
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
