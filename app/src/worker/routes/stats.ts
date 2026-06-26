import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { users } from "../../db/schema";
import { requireAuth } from "../auth";
import { personalStats } from "../lib/aggregate";

export const statsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

statsRoutes.use("*", requireAuth);

// Everything the personal dashboard tabs need, recomputed from the ledger.
statsRoutes.get("/", async (c) => {
  const stats = await personalStats(c.env.DB, c.get("userId"));
  return c.json(stats);
});

// Cheap liveness cursor for the client's auto-refresh poll: a single-row read
// of the last successful ingest time. The full /stats recompute only runs when
// this value changes.
statsRoutes.get("/cursor", async (c) => {
  const db = getDb(c.env);
  const u = await db.query.users.findFirst({ where: eq(users.id, c.get("userId")) });
  return c.json({ lastIngestAt: u?.lastIngestAt ?? null });
});
