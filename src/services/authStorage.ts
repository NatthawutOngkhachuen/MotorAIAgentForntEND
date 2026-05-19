import type { AuthSession } from "@/types/api";

export const TOKEN_STORAGE_KEYS = ["motoai_access_token", "accessToken", "access_token", "token"] as const;
export const USER_STORAGE_KEY = "motoai_user";

export interface StoredAuthUser {
  id?: string | number;
  userId?: string | number;
  user_id?: string | number;
  username?: string;
  name?: string;
  age?: string | number;
  gender?: string | number;
  role?: string;
  [key: string]: unknown;
}

type AuthRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AuthRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readToken(source: unknown) {
  if (!isRecord(source)) {
    return undefined;
  }

  for (const key of ["accessToken", "access_token", "token", "jwt"]) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/^Bearer\s+/i, "");
    }
  }

  return undefined;
}

export function extractAuthToken(session: AuthSession) {
  return readToken(session) ?? readToken(session.data);
}

function pickUserFields(source: unknown): StoredAuthUser | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  const userKeys = ["id", "userId", "user_id", "username", "name", "age", "gender", "role"] as const;
  const hasUserField = userKeys.some((key) => {
    const value = source[key];
    return (typeof value === "string" && value.trim()) || typeof value === "number";
  });

  if (!hasUserField) {
    return undefined;
  }

  const user: StoredAuthUser = { ...source };
  for (const key of ["username", "name", "role"] as const) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      user[key] = value;
    }
  }

  for (const key of ["id", "userId", "user_id", "age", "gender"] as const) {
    const value = source[key];
    if ((typeof value === "string" && value.trim()) || typeof value === "number") {
      user[key] = value;
    }
  }

  return Object.keys(user).length > 0 ? user : undefined;
}

export function extractAuthUser(session: AuthSession): StoredAuthUser | undefined {
  const candidates = [
    session.user,
    isRecord(session.data) ? session.data.user : undefined,
    session.profile,
    session.account,
    session.data,
  ];

  for (const candidate of candidates) {
    const user = pickUserFields(candidate);
    if (user) {
      return user;
    }
  }

  return undefined;
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  for (const key of TOKEN_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value?.trim()) {
      return value.trim().replace(/^Bearer\s+/i, "");
    }
  }

  return null;
}

export function getStoredAuthIdentity() {
  const user = getStoredAuthUser();
  const identity = user?.id ?? user?.userId ?? user?.user_id ?? user?.username;

  if ((typeof identity === "string" && identity.trim()) || typeof identity === "number") {
    return String(identity).trim();
  }

  return "signed-in-user";
}

export function persistAuthSession(session: AuthSession, submittedUsername?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const accessToken = extractAuthToken(session);
  const userOrData = session.user ?? session.data;

  if (accessToken) {
    TOKEN_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, accessToken));
  }
  const user = extractAuthUser(session) ?? pickUserFields(userOrData) ?? (submittedUsername?.trim() ? { username: submittedUsername.trim() } : undefined);
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function getStoredAuthUser(): StoredAuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return pickUserFields(JSON.parse(raw)) ?? null;
  } catch {
    return null;
  }
}

export function clearAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  TOKEN_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(USER_STORAGE_KEY);
}
