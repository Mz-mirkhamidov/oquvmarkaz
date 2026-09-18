import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { headers } from "next/headers";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { orgRegisterSchema } from "@/lib/schemas/org";
import { getAuth } from "@/lib/auth";
import { authPool } from "@/lib/db/auth-pool";
import { adminDb } from "@/lib/db/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit, clientIp } from "@/lib/audit";
import { slugify } from "@/lib/utils/slug";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

export const runtime = "nodejs";

/**
 * TZ v2 §4.2 (X1 fix) — registration happens *after* a session already
 * exists (from /kirish/t), so there's no bundled Telegram material to
 * expire mid-form anymore. Requires: signed in, `orgId` still null.
 */
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

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return apiErr(401, "NO_SESSION", AUTH_MESSAGES.NO_SESSION);
  }
  const user = session.user as typeof session.user & { orgId: string | null };
  if (user.orgId) {
    return apiErr(
      409,
      "ALREADY_REGISTERED",
      "Bu hisob allaqachon bir bog'chaga bog'langan. Kirish orqali davom eting.",
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = orgRegisterSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = adminDb();
  const slug = await generateUniqueSlug(db, parsed.data.org.name);

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ ...parsed.data.org, slug })
    .select("id")
    .single();
  if (orgErr || !org) {
    console.error("org_setup_create_org_error", orgErr);
    return apiErr(500, "DB_ERROR", AUTH_MESSAGES.DB_ERROR);
  }

  const { rowCount } = await authPool().query(
    `update "user" set "orgId" = $1, "appRole" = 'owner' where id = $2`,
    [org.id, user.id],
  );
  if (!rowCount) {
    console.error("org_setup_link_user_error", { userId: user.id, orgId: org.id });
    await db.from("organizations").delete().eq("id", org.id);
    return apiErr(500, "DB_ERROR", AUTH_MESSAGES.DB_ERROR);
  }

  await logAudit({
    orgId: org.id,
    actorId: user.id,
    actorRole: "owner",
    action: "org.register",
    entity: "organizations",
    entityId: org.id,
    request,
  });

  return apiOk({ org_id: org.id, slug, role: "owner" });
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
