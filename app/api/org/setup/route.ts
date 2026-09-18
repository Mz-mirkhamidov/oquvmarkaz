import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { orgRegisterSchema } from "@/lib/schemas/org";
import { verifyTelegramInitData } from "@/lib/auth/telegram";
import { adminDb } from "@/lib/db/admin";
import { issueSession } from "@/lib/auth/issue-session";
import { setSessionCookies } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit, clientIp } from "@/lib/audit";
import { slugify } from "@/lib/utils/slug";

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
  const parsed = orgRegisterSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const verified = verifyTelegramInitData(parsed.data.initData);
  if (!verified.ok) {
    return apiErr(401, "TELEGRAM_AUTH_INVALID", "Telegram orqali tasdiqlash muvaffaqiyatsiz.");
  }

  const db = adminDb();

  const { data: existing } = await db
    .from("app_users")
    .select("id")
    .eq("telegram_id", verified.user.id)
    .maybeSingle();
  if (existing) {
    return apiErr(
      409,
      "ALREADY_REGISTERED",
      "Bu Telegram hisobi allaqachon ro'yxatdan o'tgan. Kirish orqali davom eting.",
    );
  }

  const slug = await generateUniqueSlug(db, parsed.data.org.name);

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ ...parsed.data.org, slug })
    .select("id")
    .single();
  if (orgErr || !org) {
    console.error("org_setup_create_org_error", orgErr);
    return apiErr(500, "DB_ERROR", "Bog'chani yaratib bo'lmadi.");
  }

  const { data: owner, error: ownerErr } = await db
    .from("app_users")
    .insert({
      org_id: org.id,
      full_name: [verified.user.first_name, verified.user.last_name].filter(Boolean).join(" "),
      role: "owner",
      telegram_id: verified.user.id,
      telegram_username: verified.user.username,
    })
    .select("id, org_id, role")
    .single();

  if (ownerErr || !owner) {
    console.error("org_setup_create_owner_error", ownerErr);
    await db.from("organizations").delete().eq("id", org.id);
    return apiErr(500, "DB_ERROR", "Foydalanuvchini yaratib bo'lmadi.");
  }

  const { accessToken, refreshToken } = await issueSession({
    id: owner.id,
    org_id: owner.org_id,
    role: owner.role,
  });
  await setSessionCookies(accessToken, refreshToken);

  await logAudit({
    orgId: org.id,
    actorId: owner.id,
    actorRole: "owner",
    action: "org.register",
    entity: "organizations",
    entityId: org.id,
    request,
  });

  return apiOk({ org_id: org.id, slug, role: owner.role });
});

async function generateUniqueSlug(
  db: ReturnType<typeof adminDb>,
  name: string,
): Promise<string> {
  const base = slugify(name) || "bogcha";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data } = await db.from("organizations").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}
