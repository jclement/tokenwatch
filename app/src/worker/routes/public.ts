import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { users } from "../../db/schema";
import { personalStats, toPublicStats } from "../lib/aggregate";

// Unauthenticated read-only stats for the public /s/<token> share page.
export const publicRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

publicRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");
  const db = getDb(c.env);
  const u = await db.query.users.findFirst({ where: eq(users.shareToken, token) });
  if (!u) return c.json({ error: "not found" }, 404);

  const stats = await personalStats(c.env.DB, u.id);
  return c.json(
    toPublicStats(
      {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarKey ? `/api/avatar/${u.username}` : null,
      },
      stats,
    ),
  );
});
