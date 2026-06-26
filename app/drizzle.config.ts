import { defineConfig } from "drizzle-kit";

// D1 (SQLite) schema → migrations in src/db/migrations.
// Apply locally with `mise run db:migrate:local`, remotely with `db:migrate:remote`.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
