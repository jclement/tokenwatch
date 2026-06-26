// Cloudflare bindings + vars. Mirrors wrangler.jsonc.
export interface Env {
  DB: D1Database;
  AVATARS: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;

  WORKER_VERSION: string;
  GITHUB_REPO: string;
  RP_ID: string;
  RP_NAME: string;
  ORIGIN: string;
}

// Hono variables set by middleware.
export interface Vars {
  userId: string; // set by requireAuth
}
