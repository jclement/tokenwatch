import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { users } from "../../db/schema";
import { personalStats } from "../lib/aggregate";
import type { PublicStats } from "../../shared/types";

// Unauthenticated read-only stats for the public /s/<token> share page.
export const publicRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

publicRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");
  const db = getDb(c.env);
  const u = await db.query.users.findFirst({ where: eq(users.shareToken, token) });
  if (!u) return c.json({ error: "not found" }, 404);

  const stats = await personalStats(c.env.DB, u.id);
  const payload: PublicStats = {
    user: {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarKey ? `/api/avatar/${u.username}` : null,
    },
    grandTotals: stats.grandTotals,
    grandCost: stats.grandCost,
    activeDays: stats.activeDays,
    messages: stats.messages,
    historyStart: stats.historyStart,
    timeline: stats.timeline,
    byEngine: stats.byEngine,
    byModel: stats.byModel.slice(0, 6),
    streak: stats.streak,
    text: stats.text,
  };
  return c.json(payload);
});
