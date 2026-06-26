import { Hono } from "hono";
import type { Env, Vars } from "../env";
import { requireAuth } from "../auth";
import { personalStats } from "../lib/aggregate";

export const statsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

statsRoutes.use("*", requireAuth);

// Everything the personal dashboard tabs need, recomputed from the ledger.
statsRoutes.get("/", async (c) => {
  const stats = await personalStats(c.env.DB, c.get("userId"));
  return c.json(stats);
});
