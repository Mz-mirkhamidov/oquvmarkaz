import "server-only";
import { headers } from "next/headers";
import type { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth";
import { signPostgrestBearer } from "@/lib/db/postgrest-bridge";
import { apiErr, type ApiErr } from "@/lib/api/response";
import { AUTH_MESSAGES } from "@/lib/auth/errors";
import type { UserRole } from "@/lib/db/types";

export interface SessionClaims {
  sub: string;
  org_id: string;
  user_role: UserRole;
  device_id?: string;
}

export interface AuthContext {
  /** Short-lived PostgREST bearer minted from the current Better Auth
   * session — see lib/db/postgrest-bridge.ts for why this still exists. */
  token: string;
  claims: SessionClaims;
}

type GuardResult =
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse<ApiErr> };

/** Every authenticated route starts with this — 401s consistently otherwise. */
export async function requireAuth(): Promise<GuardResult> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, response: apiErr(401, "NO_SESSION", AUTH_MESSAGES.NO_SESSION) };
  }

  const user = session.user as typeof session.user & {
    orgId: string | null;
    appRole: UserRole | null;
    isActive: boolean | null;
  };

  if (user.isActive === false) {
    return { ok: false, response: apiErr(403, "USER_DISABLED", AUTH_MESSAGES.USER_DISABLED) };
  }
  if (!user.orgId || !user.appRole) {
    return { ok: false, response: apiErr(403, "NO_ORG", AUTH_MESSAGES.NO_ORG) };
  }

  const claims: SessionClaims = {
    sub: user.id,
    org_id: user.orgId,
    user_role: user.appRole,
    device_id: (session.session as { deviceId?: string | null }).deviceId ?? undefined,
  };
  const token = await signPostgrestBearer(claims);

  return { ok: true, auth: { token, claims } };
}

/** Owner/director-only routes (TZ's `is_manager()`, mirrored at the app layer). */
export async function requireManager(): Promise<GuardResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  if (result.auth.claims.user_role !== "owner" && result.auth.claims.user_role !== "director") {
    return { ok: false, response: apiErr(403, "FORBIDDEN", AUTH_MESSAGES.FORBIDDEN) };
  }
  return result;
}
