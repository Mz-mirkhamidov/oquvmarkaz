import { apiOk, withApiErrorBoundary } from "@/lib/api/response";
import { adminDb } from "@/lib/db/admin";
import { getRefreshTokenCookie, hashRefreshToken, clearSessionCookies } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = withApiErrorBoundary(async () => {
  const refreshToken = await getRefreshTokenCookie();
  if (refreshToken) {
    await adminDb()
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashRefreshToken(refreshToken))
      .is("revoked_at", null);
  }
  await clearSessionCookies();
  return apiOk({ loggedOut: true });
});
