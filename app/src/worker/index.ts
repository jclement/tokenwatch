import { Hono } from "hono";
import type { Env, Vars } from "./env";
import { authRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/account";
import { ingestRoutes } from "./routes/ingest";
import { statsRoutes } from "./routes/stats";
import { groupRoutes } from "./routes/groups";
import { versionRoutes } from "./routes/version";
import { publicRoutes } from "./routes/public";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const api = new Hono<{ Bindings: Env; Variables: Vars }>();
api.route("/auth", authRoutes);
api.route("/", accountRoutes); // /profile, /avatar/:u, /devices...
api.route("/", ingestRoutes); // /pair/claim, /ingest
api.route("/stats", statsRoutes);
api.route("/groups", groupRoutes);
api.route("/version", versionRoutes);
api.route("/public", publicRoutes);
api.get("/health", (c) => c.json({ ok: true, worker: c.env.WORKER_VERSION }));

app.route("/api", api);

// Everything else → static assets / SPA fallback (configured in wrangler.jsonc).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
