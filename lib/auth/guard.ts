import "server-only";
import type { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/session";
import { apiErr, type ApiErr } from "@/lib/api/response";
import type { VerifiedAccessToken } from "@/lib/auth/jwt";

export interface AuthContext {
  token: string;
  claims: VerifiedAccessToken;
}

type GuardResult =
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse<ApiErr> };

/** Every authenticated route starts with this — 401s consistently otherwise. */
export async function requireAuth(): Promise<GuardResult> {
  const auth = await getAuthContext();
  if (!auth) {
    return {
      ok: false,
      response: apiErr(401, "NO_SESSION", "Sessiya topilmadi. Qayta kiring."),
    };
  }
  return { ok: true, auth };
}

/** Owner/director-only routes (TZ's `is_manager()`, mirrored at the app layer). */
export async function requireManager(): Promise<GuardResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  if (result.auth.claims.user_role !== "owner" && result.auth.claims.user_role !== "director") {
    return {
      ok: false,
      response: apiErr(403, "FORBIDDEN", "Bu amal faqat rahbar uchun."),
    };
  }
  return result;
}
