import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { telegramLoginSchema } from "@/lib/schemas/auth";
import { verifyTelegramInitData } from "@/lib/auth/telegram";
import { adminDb } from "@/lib/db/admin";
import { issueSession } from "@/lib/auth/issue-session";
import { setSessionCookies } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit, clientIp } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = withApiErrorBoundary(async (request: NextRequest) => {
  const ip = clientIp(request) ?? "unknown";
  const withinLimit = await checkRateLimit(`auth:ip:${ip}`, 10, 60);
  if (!withinLimit) {
    return apiErr(
      429,
      "RATE_LIMITED",
      "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring.",
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = telegramLoginSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const verified = verifyTelegramInitData(parsed.data.initData);
  if (!verified.ok) {
    return apiErr(401, "TELEGRAM_AUTH_INVALID", "Telegram orqali tasdiqlash muvaffaqiyatsiz.");
  }

  const db = adminDb();
  const { data: user, error } = await db
    .from("app_users")
    .select("id, org_id, role, is_active")
    .eq("telegram_id", verified.user.id)
    .maybeSingle();

  if (error) {
    console.error("auth_telegram_db_error", error);
    return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
  }

  if (!user || !user.is_active) {
    return apiErr(
      403,
      "NOT_REGISTERED",
      "Bu hisob hali ro'yxatdan o'tmagan. Avval bog'changizni ro'yxatdan o'tkazing.",
    );
  }

  const { accessToken, refreshToken } = await issueSession({
    id: user.id,
    org_id: user.org_id,
    role: user.role,
  });
  await setSessionCookies(accessToken, refreshToken);

  await db
    .from("app_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  await logAudit({
    orgId: user.org_id,
    actorId: user.id,
    actorRole: user.role,
    action: "auth.login.telegram",
    entity: "app_users",
    entityId: user.id,
    request,
  });

  return apiOk({ org_id: user.org_id, role: user.role });
});
