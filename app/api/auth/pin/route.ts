import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { pinLoginSchema } from "@/lib/schemas/auth";
import { verifyPin, nextLockout } from "@/lib/auth/pin";
import { adminDb } from "@/lib/db/admin";
import { issueSession } from "@/lib/auth/issue-session";
import { setSessionCookies } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = pinLoginSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }
  const { org_slug, user_id, pin, device_key } = parsed.data;

  const withinDeviceLimit = await checkRateLimit(`auth:device:${device_key}`, 10, 60);
  if (!withinDeviceLimit) {
    return apiErr(429, "RATE_LIMITED", "Juda ko'p urinish. Biroz kutib qayta urinib ko'ring.");
  }

  const db = adminDb();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .maybeSingle();
  if (!org) return apiErr(404, "ORG_NOT_FOUND", "Bog'cha topilmadi.");

  const { data: device } = await db
    .from("devices")
    .select("id, is_blocked")
    .eq("org_id", org.id)
    .eq("device_key", device_key)
    .maybeSingle();

  if (device?.is_blocked) {
    return apiErr(403, "DEVICE_BLOCKED", "Bu qurilma bloklangan. Rahbarga murojaat qiling.");
  }

  let deviceId = device?.id;
  if (!deviceId) {
    const { data: created, error: createErr } = await db
      .from("devices")
      .insert({ org_id: org.id, device_key, user_agent: request.headers.get("user-agent") })
      .select("id")
      .single();
    if (createErr || !created) return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
    deviceId = created.id;
  }

  const { data: user } = await db
    .from("app_users")
    .select("id, org_id, role, pin_hash, failed_pin_count, locked_until, is_active")
    .eq("id", user_id)
    .eq("org_id", org.id)
    .eq("role", "teacher")
    .maybeSingle();

  if (!user || !user.is_active || !user.pin_hash) {
    return apiErr(401, "INVALID_CREDENTIALS", "Login yoki PIN noto'g'ri.");
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const remainingSeconds = Math.ceil(
      (new Date(user.locked_until).getTime() - Date.now()) / 1000,
    );
    return apiErr(
      429,
      "PIN_LOCKED",
      "Ko'p marta noto'g'ri PIN kiritildi. Biroz kutib qayta urinib ko'ring.",
      { remainingSeconds },
    );
  }

  const valid = await verifyPin(user.pin_hash, pin);

  if (!valid) {
    const failedCount = user.failed_pin_count + 1;
    const lockedUntil = nextLockout(failedCount)?.toISOString() ?? null;
    await db
      .from("app_users")
      .update({ failed_pin_count: failedCount, locked_until: lockedUntil })
      .eq("id", user.id);
    return apiErr(401, "INVALID_CREDENTIALS", "Login yoki PIN noto'g'ri.");
  }

  await db
    .from("app_users")
    .update({ failed_pin_count: 0, locked_until: null, last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  await db.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", deviceId);

  const { accessToken, refreshToken } = await issueSession(
    { id: user.id, org_id: user.org_id, role: user.role },
    deviceId,
  );
  await setSessionCookies(accessToken, refreshToken);

  await logAudit({
    orgId: user.org_id,
    actorId: user.id,
    actorRole: user.role,
    action: "auth.login.pin",
    entity: "app_users",
    entityId: user.id,
    request,
  });

  return apiOk({ org_id: user.org_id, role: user.role });
}
