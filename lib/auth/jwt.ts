import "server-only";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";
import type { UserRole } from "@/lib/db/types";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenClaims {
  sub: string; // app_users.id
  org_id: string;
  user_role: UserRole;
  device_id?: string;
}

export interface VerifiedAccessToken extends AccessTokenClaims {
  iat: number;
  exp: number;
}

function secretKey() {
  return new TextEncoder().encode(env().SUPABASE_JWT_SECRET);
}

/**
 * Signs a short-lived access token whose claim shape (`aud`, `role`, `sub`,
 * `org_id`, `user_role`) is exactly what PostgREST/RLS expects (TZ §7.3),
 * so the same token doubles as the Supabase Authorization bearer token.
 */
export async function signAccessToken(claims: AccessTokenClaims) {
  return new SignJWT({
    aud: "authenticated",
    role: "authenticated",
    org_id: claims.org_id,
    user_role: claims.user_role,
    device_id: claims.device_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(
  token: string,
): Promise<VerifiedAccessToken | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      audience: "authenticated",
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.org_id !== "string" ||
      typeof payload.user_role !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      org_id: payload.org_id,
      user_role: payload.user_role as UserRole,
      device_id: typeof payload.device_id === "string" ? payload.device_id : undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export { ACCESS_TOKEN_TTL_SECONDS };
