import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import type { Env, Vars } from "../env";
import { getDb } from "../db";
import { users, credentials, challenges } from "../../db/schema";
import { randomId, base64url, fromBase64url, utf8Bytes } from "../lib/crypto";
import { createSession, destroySession, currentUserId } from "../auth";
import type { Me } from "../../shared/types";

export const authRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

type AppCtx = Context<{ Bindings: Env; Variables: Vars }>;

const CHALLENGE_COOKIE = "tw_challenge";
const CHALLENGE_TTL = 300; // 5 min

async function putChallenge(c: AppCtx, challenge: string, userId?: string): Promise<void> {
  const db = getDb(c.env);
  const id = randomId(16);
  await db.insert(challenges).values({
    id,
    challenge,
    userId: userId ?? null,
    expiresAt: Math.floor(Date.now() / 1000) + CHALLENGE_TTL,
  });
  setCookie(c, CHALLENGE_COOKIE, id, {
    httpOnly: true,
    secure: c.env.ORIGIN.startsWith("https"),
    sameSite: "Lax",
    path: "/",
    maxAge: CHALLENGE_TTL,
  });
}

async function takeChallenge(c: AppCtx): Promise<{ challenge: string; userId: string | null } | null> {
  const id = getCookie(c, CHALLENGE_COOKIE);
  if (!id) return null;
  const db = getDb(c.env);
  const row = await db.query.challenges.findFirst({ where: eq(challenges.id, id) });
  await db.delete(challenges).where(eq(challenges.id, id));
  deleteCookie(c, CHALLENGE_COOKIE, { path: "/" });
  if (!row || row.expiresAt < Math.floor(Date.now() / 1000)) return null;
  return { challenge: row.challenge, userId: row.userId };
}

// ---- Registration: new account OR add-passkey to current account ------------

authRoutes.post("/register/options", async (c) => {
  const { username } = await c.req.json<{ username?: string }>();
  const db = getDb(c.env);
  const existingUserId = await currentUserId(c);

  let userId: string;
  let userName: string;
  let excludeIds: { id: string; transports?: string }[] = [];

  if (existingUserId) {
    // Adding another passkey to the signed-in account.
    const me = await db.query.users.findFirst({ where: eq(users.id, existingUserId) });
    if (!me) return c.json({ error: "no account" }, 400);
    userId = me.id;
    userName = me.username;
    const creds = await db.query.credentials.findMany({ where: eq(credentials.userId, userId) });
    excludeIds = creds.map((cr) => ({ id: cr.id, transports: cr.transports ?? undefined }));
  } else {
    const uname = (username ?? "").trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
      return c.json({ error: "username must be 3-20 chars (letters, numbers, _)" }, 400);
    }
    const taken = await db.query.users.findFirst({ where: eq(users.username, uname) });
    if (taken) return c.json({ error: "username taken" }, 409);
    userId = randomId(16);
    userName = uname;
  }

  const options = await generateRegistrationOptions({
    rpName: c.env.RP_NAME,
    rpID: c.env.RP_ID,
    userID: utf8Bytes(userId),
    userName,
    attestationType: "none",
    excludeCredentials: excludeIds.map((e) => ({
      id: e.id,
      transports: e.transports ? (JSON.parse(e.transports) as AuthenticatorTransportFuture[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  // Stash the pending userId + username in the challenge row (reuse userId field;
  // store username via KV keyed by challenge id is overkill — pack into challenge).
  await putChallenge(c, options.challenge, existingUserId ?? undefined);
  // For new accounts we also need username+userId at verify time; keep them in a cookie-safe KV.
  await c.env.KV.put(
    `reg:${options.challenge}`,
    JSON.stringify({ userId, userName, isNew: !existingUserId }),
    { expirationTtl: CHALLENGE_TTL },
  );
  return c.json(options);
});

authRoutes.post("/register/verify", async (c) => {
  const body = await c.req.json<{ response: RegistrationResponseJSON; name?: string }>();
  const ch = await takeChallenge(c);
  if (!ch) return c.json({ error: "challenge expired" }, 400);

  const pending = await c.env.KV.get(`reg:${ch.challenge}`);
  if (!pending) return c.json({ error: "registration state lost" }, 400);
  await c.env.KV.delete(`reg:${ch.challenge}`);
  const { userId, userName, isNew } = JSON.parse(pending) as {
    userId: string;
    userName: string;
    isNew: boolean;
  };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: c.env.ORIGIN,
      expectedRPID: c.env.RP_ID,
    });
  } catch (e) {
    return c.json({ error: `verification failed: ${(e as Error).message}` }, 400);
  }
  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "not verified" }, 400);
  }

  const db = getDb(c.env);
  const now = Math.floor(Date.now() / 1000);
  const info = verification.registrationInfo;

  if (isNew) {
    await db.insert(users).values({
      id: userId,
      username: userName,
      displayName: userName,
      createdAt: now,
    });
  }

  await db.insert(credentials).values({
    id: info.credential.id,
    userId,
    publicKey: base64url(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ? JSON.stringify(info.credential.transports) : null,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp ? 1 : 0,
    name: body.name ?? "passkey",
    createdAt: now,
    lastUsedAt: now,
  });

  await createSession(c, userId);
  return c.json({ ok: true });
});

// ---- Authentication (login) -------------------------------------------------

authRoutes.post("/login/options", async (c) => {
  const options = await generateAuthenticationOptions({
    rpID: c.env.RP_ID,
    userVerification: "preferred",
  });
  await putChallenge(c, options.challenge);
  return c.json(options);
});

authRoutes.post("/login/verify", async (c) => {
  const body = await c.req.json<{ response: AuthenticationResponseJSON }>();
  const ch = await takeChallenge(c);
  if (!ch) return c.json({ error: "challenge expired" }, 400);

  const db = getDb(c.env);
  const cred = await db.query.credentials.findFirst({
    where: eq(credentials.id, body.response.id),
  });
  if (!cred) return c.json({ error: "unknown passkey" }, 400);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: c.env.ORIGIN,
      expectedRPID: c.env.RP_ID,
      credential: {
        id: cred.id,
        publicKey: fromBase64url(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[]) : undefined,
      },
    });
  } catch (e) {
    return c.json({ error: `verification failed: ${(e as Error).message}` }, 400);
  }
  if (!verification.verified) return c.json({ error: "not verified" }, 400);

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(credentials)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: now })
    .where(eq(credentials.id, cred.id));

  await createSession(c, cred.userId);
  return c.json({ ok: true });
});

authRoutes.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

// ---- Me + passkey management ------------------------------------------------

authRoutes.get("/me", async (c) => {
  const userId = await currentUserId(c);
  if (!userId) return c.json({ user: null });
  const db = getDb(c.env);
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return c.json({ user: null });
  const me: Me = {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarKey ? `/api/avatar/${u.username}` : null,
    createdAt: u.createdAt,
    agentVersion: u.agentVersion,
    lastIngestAt: u.lastIngestAt,
    shareToken: u.shareToken,
  };
  return c.json({ user: me });
});

authRoutes.get("/passkeys", async (c) => {
  const userId = await currentUserId(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const db = getDb(c.env);
  const creds = await db.query.credentials.findMany({ where: eq(credentials.userId, userId) });
  return c.json({
    passkeys: creds.map((cr) => ({
      id: cr.id,
      name: cr.name,
      createdAt: cr.createdAt,
      lastUsedAt: cr.lastUsedAt,
      backedUp: !!cr.backedUp,
    })),
  });
});

authRoutes.delete("/passkeys/:id", async (c) => {
  const userId = await currentUserId(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const db = getDb(c.env);
  const all = await db.query.credentials.findMany({ where: eq(credentials.userId, userId) });
  if (all.length <= 1) return c.json({ error: "cannot remove your only passkey" }, 400);
  const id = decodeURIComponent(c.req.param("id"));
  const owned = all.find((cr) => cr.id === id);
  if (!owned) return c.json({ error: "not found" }, 404);
  await db.delete(credentials).where(eq(credentials.id, id));
  return c.json({ ok: true });
});
