# TokenWatch

A stylish, **shareable** dashboard for your Claude Code and Codex token spend — the same
dark/glassy/neon vibe as the original macOS app, now a web app you can share with friends.

- **Web app** — Cloudflare Worker + React/TypeScript, backed by D1. Passkey auth, profiles,
  and **groups** with invite links and leaderboards.
- **Go agent** — a tiny cross-platform binary that reads your local logs and pushes **sanitized
  stats** to your account. Lives at [`/agent`](agent).
- Deployed at **tokens.onewheelgeek.net** · repo **github.com/jclement/tokenwatch**.

## 🔒 Privacy: sanitized stats only

The agent computes everything locally and uploads **numbers and opaque ids only**. Raw logs,
message text, and file paths **never leave your machine**:

- token counts per (day, hour, session, engine, model)
- a dedup `id` that is opaque (`message.id`, or a one-way FNV hash of a user turn)
- `session` ids are UUIDs (Claude) or bare rollout filenames (Codex) — never a path
- Confessional **counts** only (swears / polite / sycophancy). Per-word swear tallies are
  **off by default** — opt in with `tokenwatch --share-swear-words`.

## Repo layout

```
app/        Cloudflare Worker + React SPA (Vite, Hono, Drizzle, D1, R2, KV)
  src/client/   React app — pages, components, theme, charts
  src/worker/   Hono API — auth (passkeys), ingest, stats, groups, version
  src/db/       Drizzle schema + migrations
  src/shared/   pricing, sarcasm, formatters, types (shared client/worker)
agent/      Go ingester (stdlib only) — parser, pairing, schedulers, self-update
scripts/    build-agent.sh (cross-compile)
.github/    ci.yml (tests), release.yml (binaries + deploy)
```

## Develop

Prereqs: [mise](https://mise.jdx.dev) (or Node 22 + Go 1.26 directly).

```sh
mise run install        # install web deps
mise run db:migrate     # create the local D1 schema
mise run dev            # worker + client on http://localhost:5173
```

Then, in another terminal, run the agent against your dev worker. Generate a pairing code in
the web UI (**Settings → Pair a new device**), then:

```sh
mise run dev:agent -- --pair ABCD-1234     # pair this machine
mise run dev:agent                          # --once sync (the default)
```

Other tasks: `mise run typecheck`, `mise run lint`, `mise run test`, `mise run agent:test`,
`mise run build`, `mise run agent:build`.

## The agent

```
tokenwatch --pair <CODE>      pair this device (from the web Settings page)
tokenwatch                    one-shot sync (default)
tokenwatch --continuous       loop, debounced by file fingerprints
tokenwatch --install          register an OS scheduler entry (launchd/systemd/schtasks)
tokenwatch --uninstall        remove it
tokenwatch --upgrade          self-update to the latest GitHub release
tokenwatch --url <URL>        override the server (for dev)
tokenwatch --share-swear-words  include per-word swear tallies (off by default)
```

Install on macOS/Linux:

```sh
curl -fsSL https://tokens.onewheelgeek.net/install.sh | sh -s -- --pair ABCD-1234
```

## Deploy (one-time Cloudflare setup)

Create the resources and paste the ids into [`app/wrangler.jsonc`](app/wrangler.jsonc):

```sh
cd app
wrangler d1 create tokenwatch            # → database_id
wrangler kv namespace create tokenwatch-kv   # → kv id
wrangler r2 bucket create tokenwatch-avatars
wrangler d1 migrations apply tokenwatch --remote --env production
```

Add a custom domain route for `tokens.onewheelgeek.net` (already in `wrangler.jsonc`), and set
the GitHub repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The passkey RP ID is
`tokens.onewheelgeek.net` in production and `localhost` in dev.

## Releasing

```sh
mise run release 1.2.3
```

Tags `v1.2.3` and pushes it. GitHub Actions then builds the agent binaries for win/mac/linux ×
amd64/arm64, attaches them to the release, applies D1 migrations, and deploys the Worker with the
version baked in. The web UI shows a banner when the Worker or a user's agent is behind the latest
release (checked against GitHub, cached in KV).

## Pricing

Sticker price — the retail value of your tokens at à-la-carte API rates. Anthropic rates are
authoritative; OpenAI/Codex are best-effort estimates. Edit
[`app/src/shared/pricing.ts`](app/src/shared/pricing.ts) to taste. Local models (Ollama, etc.)
are priced at $0.
