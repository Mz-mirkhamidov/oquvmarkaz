import "server-only";
import { SignJWT } from "jose";

import { env } from "@/lib/env";
import type { UserRole } from "@/lib/db/types";

const TTL_SECONDS = 60; // just long enough for one request's PostgREST calls

function secretKey() {
  return new TextEncoder().encode(env().SUPABASE_JWT_SECRET);
}

/**
 * Mints a short-lived PostgREST-compatible JWT from an already-verified
 * Better Auth session's claims. Not a session token itself — Better Auth
 * owns the real session (its own cookie, `lib/auth/index.ts`). This exists
 * only so lib/db/server.ts's `requestDb(token)` (RLS over PostgREST) keeps
 * working unchanged for the ~25 non-auth routes out of this rebuild's
 * scope; see AUTH_SNAPSHOT.md / TZ v2 §3.1 for why direct Postgres wasn't
 * rolled out everywhere.
 */
export async function signPostgrestBearer(claims: {
  sub: string;
  org_id: string;
  user_role: UserRole;
}): Promise<string> {
  return new SignJWT({
    aud: "authenticated",
    role: "authenticated",
    org_id: claims.org_id,
    user_role: claims.user_role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey());
}
