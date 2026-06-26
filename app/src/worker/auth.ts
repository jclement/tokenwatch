import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { Env, Vars } from "./env";
import { getDb } from "./db";
import { sessions } from "../db/schema";
import { randomId } from "./lib/crypto";

const SESSION_COOKIE = "tw_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export type AppContext = Context<{ Bindings: Env; Variables: Vars }>;

export async function createSession(c: AppContext, userId: string): Promise<void> {
  const db = getDb(c.env);
  const id = randomId(24);
  const now = Math.floor(Date.now() / 1000);
  await db.insert(sessions).values({
    id,
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SEC,
  });
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: c.env.ORIGIN.startsWith("https"),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function destroySession(c: AppContext): Promise<void> {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) {
    const db = getDb(c.env);
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

// Returns the signed-in userId, or null. Lazily reaps expired sessions.
export async function currentUserId(c: AppContext): Promise<string | null> {
  const id = getCookie(c, SESSION_COOKIE);
  if (!id) return null;
  const db = getDb(c.env);
  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, id) });
  if (!row) return null;
  if (row.expiresAt < Math.floor(Date.now() / 1000)) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return row.userId;
}

// Middleware: 401 unless authenticated; sets `userId` var.
export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Vars }>(
  async (c, next) => {
    const userId = await currentUserId(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", userId);
    await next();
  },
);
