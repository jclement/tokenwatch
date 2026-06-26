import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { users } from "../../db/schema";
import { currentUserId } from "../auth";
import type { VersionInfo } from "../../shared/types";

export const versionRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

// Latest GitHub release tag, cached in KV (~1h) so we don't hammer the API.
async function latestRelease(env: Env): Promise<string | null> {
  const cached = await env.KV.get("latest_release");
  if (cached !== null) return cached === "none" ? null : cached;
  let tag: string | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "tokenwatch-worker", Accept: "application/vnd.github+json" },
    });
    if (res.ok) {
      const json = (await res.json()) as { tag_name?: string };
      tag = json.tag_name ?? null;
    }
  } catch {
    tag = null;
  }
  await env.KV.put("latest_release", tag ?? "none", { expirationTtl: 3600 });
  return tag;
}

// Compare "v1.2.3" style tags. Returns true if `current` is behind `latest`.
function isBehind(current: string, latest: string | null): boolean {
  if (!latest) return false;
  const norm = (s: string) => s.replace(/^v/, "").split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
  const a = norm(current);
  const b = norm(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

versionRoutes.get("/", async (c) => {
  const latest = await latestRelease(c.env);
  const worker = c.env.WORKER_VERSION;

  let agentStale = false;
  const userId = await currentUserId(c);
  if (userId) {
    const db = getDb(c.env);
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (u?.agentVersion) agentStale = isBehind(u.agentVersion, latest);
  }

  const info: VersionInfo = {
    worker,
    latestRelease: latest,
    workerStale: isBehind(worker, latest),
    agentLatest: latest,
    agentStale,
  };
  return c.json(info);
});
