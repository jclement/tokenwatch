// Thin fetch wrapper around the worker API. All calls are same-origin and
// cookie-authenticated (httpOnly session). Throws ApiError on non-2xx.

import type {
  Me,
  StatsPayload,
  Group,
  GroupDetail,
  VersionInfo,
  PublicStats,
} from "../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: init?.body && !(init.body instanceof ArrayBuffer)
      ? { "content-type": "application/json", ...(init?.headers ?? {}) }
      : init?.headers,
    ...init,
  });
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" && data && "error" in data ? (data as { error: string }).error : res.statusText;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => req<T>(path, { method: "DELETE" });

export const api = {
  // auth
  me: () => req<{ user: Me | null }>("/auth/me"),
  registerOptions: (username?: string) => post<PublicKeyCredentialCreationOptionsJSON>("/auth/register/options", { username }),
  registerVerify: (response: unknown, name?: string) => post<{ ok: true }>("/auth/register/verify", { response, name }),
  loginOptions: () => post<PublicKeyCredentialRequestOptionsJSON>("/auth/login/options"),
  loginVerify: (response: unknown) => post<{ ok: true }>("/auth/login/verify", { response }),
  logout: () => post<{ ok: true }>("/auth/logout"),
  passkeys: () => req<{ passkeys: PasskeyInfo[] }>("/auth/passkeys"),
  removePasskey: (id: string) => del<{ ok: true }>(`/auth/passkeys/${encodeURIComponent(id)}`),

  // profile / devices
  updateProfile: (p: { displayName?: string; username?: string }) => patch<{ ok: true }>("/profile", p),
  uploadAvatar: (file: Blob) =>
    req<{ avatarUrl: string }>("/avatar", { method: "PUT", body: file, headers: { "content-type": file.type } }),
  generatePairing: () => post<{ code: string; expiresInSec: number }>("/devices/pair"),
  devices: () => req<{ devices: DeviceInfo[] }>("/devices"),
  removeDevice: (id: string) => del<{ ok: true }>(`/devices/${id}`),

  // stats
  stats: () => req<StatsPayload>("/stats"),
  statsCursor: () => req<{ lastIngestAt: number | null }>("/stats/cursor"),

  // public sharing
  enableShare: () => post<{ shareToken: string }>("/share"),
  disableShare: () => del<{ ok: true }>("/share"),
  publicStats: (token: string) => req<PublicStats>(`/public/${token}`),

  // groups
  groups: () => req<{ groups: Group[] }>("/groups"),
  createGroup: (name: string) => post<{ id: string; slug: string; inviteCode: string }>("/groups", { name }),
  joinGroup: (inviteCode: string) => post<{ id: string; slug: string }>("/groups/join", { inviteCode }),
  group: (slug: string) => req<GroupDetail & { inviteCode?: string }>(`/groups/${slug}`),
  groupMember: (slug: string, userId: string) => req<PublicStats>(`/groups/${slug}/members/${userId}`),
  leaveGroup: (slug: string) => post<{ ok: true }>(`/groups/${slug}/leave`),

  // version
  version: () => req<VersionInfo>("/version"),
};

export interface PasskeyInfo {
  id: string;
  name: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  backedUp: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string | null;
  platform: string | null;
  arch: string | null;
  agentVersion: string | null;
  lastSeenAt: number | null;
  createdAt: number;
}

// Minimal WebAuthn JSON option shapes (the browser lib refines these).
type PublicKeyCredentialCreationOptionsJSON = Record<string, unknown>;
type PublicKeyCredentialRequestOptionsJSON = Record<string, unknown>;
