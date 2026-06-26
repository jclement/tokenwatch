import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { groups, groupMembers, users } from "../../db/schema";
import { requireAuth } from "../auth";
import { randomId, slugify } from "../lib/crypto";
import { groupRollups, personalStats, toPublicStats } from "../lib/aggregate";
import type { Group, GroupDetail, PublicUser, LeaderboardRow } from "../../shared/types";

export const groupRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
groupRoutes.use("*", requireAuth);

const publicUser = (u: typeof users.$inferSelect): PublicUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarKey ? `/api/avatar/${u.username}` : null,
});

// List the groups I'm in.
groupRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const userId = c.get("userId");
  const mine = await db.query.groupMembers.findMany({ where: eq(groupMembers.userId, userId) });
  const ids = mine.map((m) => m.groupId);
  if (ids.length === 0) return c.json({ groups: [] as Group[] });
  const gs = await db.query.groups.findMany({ where: inArray(groups.id, ids) });
  const counts = await c.env.DB.prepare(
    `SELECT group_id, COUNT(*) AS n FROM group_members WHERE group_id IN (${ids.map(() => "?").join(",")}) GROUP BY group_id`,
  )
    .bind(...ids)
    .all<{ group_id: string; n: number }>();
  const countMap = new Map((counts.results ?? []).map((r) => [r.group_id, r.n]));
  return c.json({
    groups: gs.map<Group>((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      ownerId: g.ownerId,
      memberCount: countMap.get(g.id) ?? 1,
      createdAt: g.createdAt,
    })),
  });
});

// Create a group; creator becomes owner + first member.
groupRoutes.post("/", async (c) => {
  const { name } = await c.req.json<{ name?: string }>();
  const trimmed = (name ?? "").trim();
  if (trimmed.length < 2 || trimmed.length > 40) return c.json({ error: "name must be 2-40 chars" }, 400);
  const db = getDb(c.env);
  const userId = c.get("userId");
  const now = Math.floor(Date.now() / 1000);
  const id = randomId(12);
  const slug = `${slugify(trimmed)}-${randomId(3).toLowerCase()}`;
  const inviteCode = randomId(9);
  await db.insert(groups).values({ id, name: trimmed, slug, ownerId: userId, inviteCode, createdAt: now });
  await db.insert(groupMembers).values({ groupId: id, userId, role: "owner", joinedAt: now });
  return c.json({ id, slug, inviteCode });
});

// Join via invite code.
groupRoutes.post("/join", async (c) => {
  const { inviteCode } = await c.req.json<{ inviteCode?: string }>();
  const code = (inviteCode ?? "").trim();
  if (!code) return c.json({ error: "missing invite code" }, 400);
  const db = getDb(c.env);
  const g = await db.query.groups.findFirst({ where: eq(groups.inviteCode, code) });
  if (!g) return c.json({ error: "invalid invite" }, 404);
  const userId = c.get("userId");
  const already = await db.query.groupMembers.findFirst({
    where: (m, { and }) => and(eq(m.groupId, g.id), eq(m.userId, userId)),
  });
  if (!already) {
    await db.insert(groupMembers).values({
      groupId: g.id,
      userId,
      role: "member",
      joinedAt: Math.floor(Date.now() / 1000),
    });
  }
  return c.json({ id: g.id, slug: g.slug });
});

// Group detail + leaderboard.
groupRoutes.get("/:slug", async (c) => {
  const db = getDb(c.env);
  const userId = c.get("userId");
  const g = await db.query.groups.findFirst({ where: eq(groups.slug, c.req.param("slug")) });
  if (!g) return c.notFound();
  const members = await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, g.id) });
  const memberIds = members.map((m) => m.userId);
  if (!memberIds.includes(userId)) return c.json({ error: "not a member" }, 403);

  const memberUsers = await db.query.users.findMany({ where: inArray(users.id, memberIds) });
  const userMap = new Map(memberUsers.map((u) => [u.id, u]));

  const rollups = await groupRollups(c.env.DB, memberIds);
  const leaderboard: LeaderboardRow[] = rollups
    .map((r) => {
      const u = userMap.get(r.userId);
      if (!u) return null;
      return {
        user: publicUser(u),
        cost: r.cost,
        tokens: r.tokens,
        activeDays: r.activeDays,
        currentStreak: r.currentStreak,
        swears: r.swears,
        polite: r.polite,
        sycophancy: r.sycophancy,
      } satisfies LeaderboardRow;
    })
    .filter((x): x is LeaderboardRow => x !== null)
    .sort((a, b) => b.cost - a.cost);

  const detail: GroupDetail = {
    id: g.id,
    name: g.name,
    slug: g.slug,
    ownerId: g.ownerId,
    memberCount: memberIds.length,
    createdAt: g.createdAt,
    members: memberUsers.map(publicUser),
    leaderboard,
    totalCost: leaderboard.reduce((s, r) => s + r.cost, 0),
    totalTokens: leaderboard.reduce((s, r) => s + r.tokens, 0),
    // expose the invite code only to the owner
    ...(g.ownerId === userId ? { inviteCode: g.inviteCode } : {}),
  } as GroupDetail & { inviteCode?: string };

  return c.json(detail);
});

// A single member's curated stats (same shape as the public share page),
// visible only to fellow members of the group.
groupRoutes.get("/:slug/members/:userId", async (c) => {
  const db = getDb(c.env);
  const requester = c.get("userId");
  const targetId = c.req.param("userId");
  const g = await db.query.groups.findFirst({ where: eq(groups.slug, c.req.param("slug")) });
  if (!g) return c.notFound();
  const members = await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, g.id) });
  const ids = new Set(members.map((m) => m.userId));
  if (!ids.has(requester)) return c.json({ error: "not a member" }, 403);
  if (!ids.has(targetId)) return c.json({ error: "not in this group" }, 404);
  const u = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!u) return c.notFound();
  const stats = await personalStats(c.env.DB, targetId);
  return c.json(toPublicStats(publicUser(u), stats));
});

// Leave a group (owner leaving deletes it).
groupRoutes.post("/:slug/leave", async (c) => {
  const db = getDb(c.env);
  const userId = c.get("userId");
  const g = await db.query.groups.findFirst({ where: eq(groups.slug, c.req.param("slug")) });
  if (!g) return c.notFound();
  if (g.ownerId === userId) {
    await db.delete(groups).where(eq(groups.id, g.id)); // cascades members
  } else {
    await c.env.DB.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`)
      .bind(g.id, userId)
      .run();
  }
  return c.json({ ok: true });
});
