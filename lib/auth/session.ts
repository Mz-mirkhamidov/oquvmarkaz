import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";

import { verifyAccessToken, type VerifiedAccessToken } from "@/lib/auth/jwt";

export const ACCESS_COOKIE = "qalqon_at";
export const REFRESH_COOKIE = "qalqon_rt";

export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const isProd = process.env.NODE_ENV === "production";

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Reads and verifies the access token from the request's cookies. */
export async function getSession(): Promise<VerifiedAccessToken | null> {
  const auth = await getAuthContext();
  return auth?.claims ?? null;
}

/**
 * Reads the raw access token cookie plus its verified claims in one go —
 * routes that need to forward the token itself (as the Supabase bearer,
 * for the RLS-scoped client) use this instead of getSession().
 */
export async function getAuthContext(): Promise<
  { token: string; claims: VerifiedAccessToken } | null
> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  return { token, claims };
}

export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getRefreshTokenCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
