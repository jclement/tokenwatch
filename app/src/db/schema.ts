import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

// ---- Accounts & auth --------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // random id
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarKey: text("avatar_key"), // R2 object key, or null → generated avatar
  createdAt: integer("created_at").notNull(),
  // last agent push, for staleness banners
  agentVersion: text("agent_version"),
  lastIngestAt: integer("last_ingest_at"),
});

// WebAuthn passkeys — multiple per user.
export const credentials = sqliteTable(
  "credentials",
  {
    id: text("id").primaryKey(), // base64url credential id
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(), // base64url COSE key
    counter: integer("counter").notNull().default(0),
    transports: text("transports"), // JSON array
    deviceType: text("device_type"),
    backedUp: integer("backed_up").notNull().default(0),
    name: text("name"), // user-given label
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
  },
  (t) => [index("cred_user_idx").on(t.userId)],
);

// Server-side web sessions (httpOnly cookie holds the id).
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sess_user_idx").on(t.userId)],
);

// Transient WebAuthn challenges (registration/auth ceremonies).
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(), // anonymous challenge handle (cookie)
  challenge: text("challenge").notNull(),
  userId: text("user_id"), // set for add-passkey on an existing account
  expiresAt: integer("expires_at").notNull(),
});

// ---- Devices (the Go agent) -------------------------------------------------

// Short-lived pairing codes minted from an authed web session.
export const pairingCodes = sqliteTable("pairing_codes", {
  code: text("code").primaryKey(), // short human-typable code
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  claimedAt: integer("claimed_at"),
});

// Long-lived device tokens (hashed). Agent sends Bearer <token>.
export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // sha-256 of the secret
    name: text("name"),
    platform: text("platform"),
    arch: text("arch"),
    agentVersion: text("agent_version"),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at"),
  },
  (t) => [index("dev_user_idx").on(t.userId), index("dev_token_idx").on(t.tokenHash)],
);

// ---- The ledger -------------------------------------------------------------

// One row per billed message, scoped per user. PK (user_id, id) is the
// no-double-count guarantee — same trick as the Swift Database.
export const events = sqliteTable(
  "events",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    day: integer("day").notNull(), // start-of-day epoch seconds
    ts: integer("ts").notNull().default(0),
    hour: integer("hour").notNull().default(-1),
    session: text("session").notNull().default(""),
    engine: text("engine").notNull(),
    model: text("model").notNull(),
    input: integer("input").notNull(),
    cacheRead: integer("cache_read").notNull(),
    cacheCreate: integer("cache_create").notNull(),
    output: integer("output").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("ev_user_day_idx").on(t.userId, t.day),
    index("ev_user_session_idx").on(t.userId, t.session),
    index("ev_user_hour_idx").on(t.userId, t.hour),
  ],
);

// Per-message Confessional counts, scoped per user. PK (user_id, id) dedups.
export const textStats = sqliteTable(
  "text_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    day: integer("day").notNull(),
    swears: integer("swears").notNull(),
    polite: integer("polite").notNull(),
    agreed: integer("agreed").notNull(),
    sorry: integer("sorry").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("ts_user_day_idx").on(t.userId, t.day),
  ],
);

// Optional per-word swear tallies (opt-in via --share-swear-words).
export const wordHits = sqliteTable(
  "word_hits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    word: text("word").notNull(),
    n: integer("n").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id, t.word] })],
);

// ---- Groups -----------------------------------------------------------------

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | member
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("gm_user_idx").on(t.userId),
  ],
);

