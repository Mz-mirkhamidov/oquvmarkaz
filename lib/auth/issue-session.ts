import "server-only";

import { adminDb } from "@/lib/db/admin";
import { signAccessToken } from "@/lib/auth/jwt";
import { generateRefreshToken, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/auth/session";
import type { UserRole } from "@/lib/db/types";

export interface SessionUser {
  id: string;
  org_id: string;
  role: UserRole;
}

/** Signs a fresh access token and issues+stores a new refresh token. */
export async function issueSession(user: SessionUser, deviceId?: string) {
  const accessToken = await signAccessToken({
    sub: user.id,
    org_id: user.org_id,
    user_role: user.role,
    device_id: deviceId,
  });

  const { token: refreshToken, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { data: inserted, error } = await adminDb()
    .from("refresh_tokens")
    .insert({
      user_id: user.id,
      device_id: deviceId ?? null,
      token_hash: hash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error(`Failed to persist refresh token: ${error?.message}`);
  }

  return { accessToken, refreshToken, refreshTokenId: inserted.id };
}
