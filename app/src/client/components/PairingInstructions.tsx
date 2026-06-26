import { useState } from "react";

type OS = "mac" | "linux" | "win";
type Method = "brew" | "curl" | "manual";
type Arch = "arm64" | "amd64";

const RELEASES = "https://github.com/jclement/tokenwatch/releases/latest";
const DL = "https://github.com/jclement/tokenwatch/releases/latest/download";

const OS_LABELS: Record<OS, string> = { mac: "macOS", linux: "Linux", win: "Windows" };
const METHODS: Record<OS, Method[]> = {
  mac: ["brew", "curl", "manual"],
  linux: ["curl", "brew", "manual"],
  win: ["manual"],
};
const METHOD_LABELS: Record<Method, string> = { brew: "Homebrew", curl: "curl", manual: "Manual" };
const SCHEDULER: Record<OS, string> = {
  mac: "a launchd agent",
  linux: "a systemd user timer (cron fallback)",
  win: "a Scheduled Task",
};

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "win";
  if (/Mac/i.test(ua)) return "mac";
  return "linux";
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 pr-12 font-mono text-[12px] leading-relaxed text-ink">
        {children}
      </pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-subtle transition hover:bg-white/10 hover:text-ink"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: (o: { value: T; label: string }) => string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-[12px] font-medium transition ${
            value === o.value ? "bg-white/10 text-ink" : "text-subtle hover:text-ink"
          }`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function PairingInstructions({ code }: { code: string }) {
  const [os, setOS] = useState<OS>(detectOS);
  const methods = METHODS[os];
  const [method, setMethod] = useState<Method>(methods[0]);
  const [arch, setArch] = useState<Arch>(os === "mac" ? "arm64" : "amd64");

  // keep method valid when OS changes
  const activeMethod = methods.includes(method) ? method : methods[0];

  const setOSAndReset = (next: OS) => {
    setOS(next);
    setMethod(METHODS[next][0]);
    setArch(next === "mac" ? "arm64" : "amd64");
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-mint/20 bg-white/[0.03] p-4">
      <div>
        <div className="text-[12px] text-subtle">Pairing code · valid ~10 min</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-2xl tracking-widest text-mint">{code}</span>
          <CopyChip text={code} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-faint">OS</span>
        <Segmented
          value={os}
          onChange={setOSAndReset}
          options={(["mac", "linux", "win"] as OS[]).map((v) => ({ value: v, label: OS_LABELS[v] }))}
          label={(o) => o.label}
        />
        {methods.length > 1 && (
          <>
            <span className="ml-2 text-[12px] text-faint">Method</span>
            <Segmented
              value={activeMethod}
              onChange={setMethod}
              options={methods.map((v) => ({ value: v, label: METHOD_LABELS[v] }))}
              label={(o) => o.label}
            />
          </>
        )}
      </div>

      {/* Step 1 — install + pair */}
      <div className="space-y-1.5">
        <div className="text-[12px] font-semibold text-subtle">1 · Install &amp; pair</div>
        <Install os={os} method={activeMethod} arch={arch} setArch={setArch} code={code} />
      </div>

      {/* Step 2 — sync once or run as a service */}
      <div className="space-y-1.5">
        <div className="text-[12px] font-semibold text-subtle">2 · Sync once, or keep it running</div>
        <p className="text-[12px] text-faint">
          A one-shot sync runs immediately. To sync automatically in the background, install it as a
          service — this registers {SCHEDULER[os]}.
        </p>
        <CodeBlock>{`tokenwatch            # sync once now
tokenwatch --continuous   # stay running in this terminal
tokenwatch --install      # run automatically in the background
tokenwatch --uninstall    # stop the background service`}</CodeBlock>
      </div>
    </div>
  );
}

function Install({
  os,
  method,
  arch,
  setArch,
  code,
}: {
  os: OS;
  method: Method;
  arch: Arch;
  setArch: (a: Arch) => void;
  code: string;
}) {
  if (method === "brew") {
    return (
      <CodeBlock>{`brew install jclement/tap/tokenwatch
tokenwatch --pair ${code}`}</CodeBlock>
    );
  }

  if (method === "curl") {
    return (
      <>
        <CodeBlock>{`curl -fsSL ${location.origin}/install.sh | sh -s -- --pair ${code}`}</CodeBlock>
        <p className="text-[11px] text-faint">
          Installs to <span className="font-mono">/usr/local/bin</span> or{" "}
          <span className="font-mono">~/.local/bin</span>, then pairs and runs an initial sync.
        </p>
      </>
    );
  }

  // manual
  if (os === "win") {
    const asset = `tokenwatch_windows_${arch}.zip`;
    return (
      <>
        <ArchToggle arch={arch} setArch={setArch} />
        <CodeBlock>{`# PowerShell
irm ${DL}/${asset} -OutFile tokenwatch.zip
Expand-Archive tokenwatch.zip -DestinationPath .
.\\tokenwatch.exe --pair ${code}`}</CodeBlock>
      </>
    );
  }

  const goos = os === "mac" ? "darwin" : "linux";
  const asset = `tokenwatch_${goos}_${arch}.tar.gz`;
  return (
    <>
      <ArchToggle arch={arch} setArch={setArch} />
      <CodeBlock>{`curl -fsSL ${DL}/${asset} | tar -xz
./tokenwatch --pair ${code}`}</CodeBlock>
      <p className="text-[11px] text-faint">
        Or grab it from the{" "}
        <a className="text-cyan underline" href={RELEASES} target="_blank" rel="noreferrer">
          releases page
        </a>
        .
      </p>
    </>
  );
}

function ArchToggle({ arch, setArch }: { arch: Arch; setArch: (a: Arch) => void }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="text-[11px] text-faint">Chip</span>
      <Segmented
        value={arch}
        onChange={setArch}
        options={[
          { value: "arm64" as Arch, label: "ARM64" },
          { value: "amd64" as Arch, label: "Intel/AMD64" },
        ]}
        label={(o) => o.label}
      />
    </div>
  );
}

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-subtle transition hover:bg-white/10 hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
