import { apiOk, apiErr } from "@/lib/api/response";
import { adminDb } from "@/lib/db/admin";
import { issueSession } from "@/lib/auth/issue-session";
import {
  getRefreshTokenCookie,
  hashRefreshToken,
  setSessionCookies,
  clearSessionCookies,
} from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  const refreshToken = await getRefreshTokenCookie();
  if (!refreshToken) {
    return apiErr(401, "NO_SESSION", "Sessiya topilmadi. Qayta kiring.");
  }

  const db = adminDb();
  const hash = hashRefreshToken(refreshToken);

  const { data: stored } = await db
    .from("refresh_tokens")
    .select("id, user_id, device_id, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!stored) {
    await clearSessionCookies();
    return apiErr(401, "NO_SESSION", "Sessiya topilmadi. Qayta kiring.");
  }

  // A revoked token being replayed means it was stolen and already
  // rotated by the legitimate client — kill every session for this user.
  if (stored.revoked_at) {
    await db
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", stored.user_id)
      .is("revoked_at", null);
    await logAudit({
      orgId: null,
      actorId: stored.user_id,
      actorRole: null,
      action: "auth.refresh_reuse_detected",
      entity: "refresh_tokens",
      entityId: stored.id,
    });
    await clearSessionCookies();
    return apiErr(401, "SESSION_REVOKED", "Sessiya bekor qilindi. Qayta kiring.");
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await clearSessionCookies();
    return apiErr(401, "SESSION_EXPIRED", "Sessiya muddati tugagan. Qayta kiring.");
  }

  const { data: user } = await db
    .from("app_users")
    .select("id, org_id, role, is_active")
    .eq("id", stored.user_id)
    .maybeSingle();

  if (!user || !user.is_active) {
    await clearSessionCookies();
    return apiErr(401, "NO_SESSION", "Sessiya topilmadi. Qayta kiring.");
  }

  const {
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenId,
  } = await issueSession(
    { id: user.id, org_id: user.org_id, role: user.role },
    stored.device_id ?? undefined,
  );

  await db
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString(), replaced_by: refreshTokenId })
    .eq("id", stored.id);

  await setSessionCookies(accessToken, newRefreshToken);

  return apiOk({ org_id: user.org_id, role: user.role });
}
