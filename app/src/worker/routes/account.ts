import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { users, devices, pairingCodes } from "../../db/schema";
import { requireAuth } from "../auth";
import { pairingCode, randomId } from "../lib/crypto";

// Authenticated account management: profile, avatars, devices/pairing.
export const accountRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- Profile ----------------------------------------------------------------

accountRoutes.patch("/profile", requireAuth, async (c) => {
  const { displayName, username } = await c.req.json<{ displayName?: string; username?: string }>();
  const db = getDb(c.env);
  const userId = c.get("userId");
  const patch: Record<string, unknown> = {};
  if (typeof displayName === "string") patch.displayName = displayName.slice(0, 50);
  if (typeof username === "string") {
    const uname = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) return c.json({ error: "invalid username" }, 400);
    const taken = await db.query.users.findFirst({ where: eq(users.username, uname) });
    if (taken && taken.id !== userId) return c.json({ error: "username taken" }, 409);
    patch.username = uname;
  }
  if (Object.keys(patch).length) await db.update(users).set(patch).where(eq(users.id, userId));
  return c.json({ ok: true });
});

// Upload avatar → R2. Body is the raw image; content-type drives the extension.
accountRoutes.put("/avatar", requireAuth, async (c) => {
  const userId = c.get("userId");
  const ct = c.req.header("content-type") ?? "application/octet-stream";
  if (!ct.startsWith("image/")) return c.json({ error: "expected an image" }, 400);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > 2 * 1024 * 1024) return c.json({ error: "image too large (max 2MB)" }, 413);
  const db = getDb(c.env);
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return c.json({ error: "no account" }, 400);
  const key = `avatars/${u.username}-${randomId(6)}`;
  await c.env.AVATARS.put(key, buf, { httpMetadata: { contentType: ct } });
  // delete the previous object, best-effort
  if (u.avatarKey && u.avatarKey !== key) await c.env.AVATARS.delete(u.avatarKey).catch(() => {});
  await db.update(users).set({ avatarKey: key }).where(eq(users.id, userId));
  return c.json({ avatarUrl: `/api/avatar/${u.username}` });
});

// Serve an avatar by username (public).
accountRoutes.get("/avatar/:username", async (c) => {
  const db = getDb(c.env);
  const u = await db.query.users.findFirst({ where: eq(users.username, c.req.param("username")) });
  if (!u?.avatarKey) return c.notFound();
  const obj = await c.env.AVATARS.get(u.avatarKey);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/png",
      "cache-control": "public, max-age=300",
    },
  });
});

// ---- Devices / pairing ------------------------------------------------------

// Generate a one-time pairing code for a new device.
accountRoutes.post("/devices/pair", requireAuth, async (c) => {
  const db = getDb(c.env);
  const code = pairingCode();
  await db.insert(pairingCodes).values({
    code,
    userId: c.get("userId"),
    expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 min
  });
  return c.json({ code, expiresInSec: 600 });
});

accountRoutes.get("/devices", requireAuth, async (c) => {
  const db = getDb(c.env);
  const list = await db.query.devices.findMany({ where: eq(devices.userId, c.get("userId")) });
  return c.json({
    devices: list.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      arch: d.arch,
      agentVersion: d.agentVersion,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
    })),
  });
});

accountRoutes.delete("/devices/:id", requireAuth, async (c) => {
  const db = getDb(c.env);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const dev = await db.query.devices.findFirst({ where: eq(devices.id, id) });
  if (!dev || dev.userId !== userId) return c.json({ error: "not found" }, 404);
  await db.delete(devices).where(eq(devices.id, id));
  return c.json({ ok: true });
});

// ---- Public share toggle ----------------------------------------------------

// Enable public sharing → mint (or reuse) a share token.
accountRoutes.post("/share", requireAuth, async (c) => {
  const db = getDb(c.env);
  const userId = c.get("userId");
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return c.json({ error: "no account" }, 400);
  const token = u.shareToken ?? randomId(12);
  if (!u.shareToken) await db.update(users).set({ shareToken: token }).where(eq(users.id, userId));
  return c.json({ shareToken: token });
});

// Disable public sharing.
accountRoutes.delete("/share", requireAuth, async (c) => {
  const db = getDb(c.env);
  await db.update(users).set({ shareToken: null }).where(eq(users.id, c.get("userId")));
  return c.json({ ok: true });
});
