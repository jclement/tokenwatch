import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { devices, pairingCodes, users } from "../../db/schema";
import { randomId, sha256Hex } from "../lib/crypto";
import { dayKey } from "../lib/days";
import type { IngestRequest, IngestResponse, IngestEvent } from "../../shared/types";

export const ingestRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

// Agent exchanges a pairing code for a long-lived device token.
ingestRoutes.post("/pair/claim", async (c) => {
  const body = await c.req.json<{
    code?: string;
    name?: string;
    platform?: string;
    arch?: string;
    agentVersion?: string;
  }>();
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return c.json({ error: "missing code" }, 400);

  const db = getDb(c.env);
  const now = Math.floor(Date.now() / 1000);
  const pc = await db.query.pairingCodes.findFirst({ where: eq(pairingCodes.code, code) });
  if (!pc || pc.claimedAt || pc.expiresAt < now) {
    return c.json({ error: "invalid or expired code" }, 400);
  }

  const secret = randomId(32);
  const tokenHash = await sha256Hex(secret);
  const deviceId = randomId(16);
  await db.insert(devices).values({
    id: deviceId,
    userId: pc.userId,
    tokenHash,
    name: body.name ?? "device",
    platform: body.platform ?? null,
    arch: body.arch ?? null,
    agentVersion: body.agentVersion ?? null,
    createdAt: now,
    lastSeenAt: now,
  });
  await db.update(pairingCodes).set({ claimedAt: now }).where(eq(pairingCodes.code, code));

  // token format: "<deviceId>.<secret>" — deviceId lets us look up without scanning.
  return c.json({ deviceToken: `${deviceId}.${secret}`, deviceId });
});

// Resolve a Bearer device token → userId, updating last-seen + agent version.
async function deviceFromAuth(c: { req: { header: (k: string) => string | undefined } }, env: Env, agentVersion?: string) {
  const auth = c.req.header("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const [deviceId, secret] = m[1].split(".");
  if (!deviceId || !secret) return null;
  const db = getDb(env);
  const dev = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) });
  if (!dev) return null;
  const hash = await sha256Hex(secret);
  if (hash !== dev.tokenHash) return null;
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(devices)
    .set({ lastSeenAt: now, agentVersion: agentVersion ?? dev.agentVersion })
    .where(eq(devices.id, deviceId));
  return { userId: dev.userId, db, now };
}

// Sanitized stats push, keyed on (user_id, id). A usage id that arrives again
// keeps the larger value of each token count: Claude Code logs one response
// over several lines and early lines can carry a partial output count, so an
// agent that synced mid-response must be able to correct it later.
ingestRoutes.post("/ingest", async (c) => {
  const body = await c.req.json<IngestRequest>();
  const auth = await deviceFromAuth(c, c.env, body.agentVersion);
  if (!auth) return c.json({ error: "unauthorized" }, 401);
  const { userId, db, now } = auth;

  const list = Array.isArray(body.events) ? body.events : [];
  if (list.length === 0) return c.json<IngestResponse>({ received: 0, inserted: 0 });

  // Build batched INSERT OR IGNORE statements via raw D1 (drizzle has no
  // portable "or ignore" + multi-row helper across all versions, so be explicit).
  const stmts: D1PreparedStatement[] = [];
  for (const e of list) {
    if (!validEvent(e)) continue;
    const day = dayKey(e.day);
    // The agent emits two record kinds (mirroring the Swift two-table split):
    // usage records (token counts, engine+model) and text records (confessional
    // counts, no tokens, model ""). Route each to its own table — a zero-token
    // text record must NOT pollute the events ledger.
    const hasTokens =
      (e.input | 0) + (e.cacheRead | 0) + (e.cacheCreate | 0) + (e.output | 0) > 0;
    if (hasTokens && (e.engine === "Claude" || e.engine === "Codex")) {
      stmts.push(
        c.env.DB.prepare(
          `INSERT INTO events
           (user_id,id,day,ts,hour,session,engine,model,input,cache_read,cache_create,cache_create_1h,output)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(user_id,id) DO UPDATE SET
             input = MAX(input, excluded.input),
             cache_read = MAX(cache_read, excluded.cache_read),
             cache_create = MAX(cache_create, excluded.cache_create),
             cache_create_1h = MAX(cache_create_1h, excluded.cache_create_1h),
             output = MAX(output, excluded.output)
           WHERE excluded.input > input OR excluded.cache_read > cache_read
              OR excluded.cache_create > cache_create
              OR excluded.cache_create_1h > cache_create_1h
              OR excluded.output > output`,
        ).bind(
          userId, e.id, day, e.ts, e.hour, e.session ?? "", e.engine, e.model,
          e.input | 0, e.cacheRead | 0, e.cacheCreate | 0, (e.cacheCreate1h ?? 0) | 0, e.output | 0,
        ),
      );
    }
    const hasText = e.swears || e.polite || e.agreed || e.sorry;
    if (hasText) {
      stmts.push(
        c.env.DB.prepare(
          `INSERT OR IGNORE INTO text_stats (user_id,id,day,swears,polite,agreed,sorry)
           VALUES (?,?,?,?,?,?,?)`,
        ).bind(userId, e.id, day, e.swears | 0, e.polite | 0, e.agreed | 0, e.sorry | 0),
      );
    }
    if (e.swearWords) {
      for (const [word, n] of Object.entries(e.swearWords)) {
        stmts.push(
          c.env.DB.prepare(
            `INSERT OR IGNORE INTO word_hits (user_id,id,word,n) VALUES (?,?,?,?)`,
          ).bind(userId, e.id, word, n | 0),
        );
      }
    }
  }

  let inserted = 0;
  // D1 batch in chunks to stay under statement limits.
  for (let i = 0; i < stmts.length; i += 100) {
    const chunk = stmts.slice(i, i + 100);
    const res = await c.env.DB.batch(chunk);
    for (const r of res) inserted += r.meta?.changes ?? 0;
  }

  await db
    .update(users)
    .set({ lastIngestAt: now, agentVersion: body.agentVersion ?? null })
    .where(eq(users.id, userId));

  return c.json<IngestResponse>({ received: list.length, inserted });
});

function validEvent(e: IngestEvent): boolean {
  return (
    typeof e.id === "string" &&
    e.id.length > 0 &&
    (e.engine === "Claude" || e.engine === "Codex") &&
    typeof e.model === "string" &&
    Number.isFinite(e.day) &&
    Number.isFinite(e.ts)
  );
}
