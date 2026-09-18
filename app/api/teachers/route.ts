import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { teacherCreateSchema } from "@/lib/schemas/teacher";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { hashPin } from "@/lib/auth/pin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const GET = withApiErrorBoundary(async () => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const db = requestDb(session.auth.token);
  const { data, error } = await db
    .from("app_users")
    .select("id, full_name, role, is_active, last_seen_at, created_at")
    .eq("org_id", session.auth.claims.org_id)
    .eq("role", "teacher")
    .order("full_name", { ascending: true });

  if (error) return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
  return apiOk(data);
});

export const POST = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => null);
  const parsed = teacherCreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const pinHash = await hashPin(parsed.data.pin);
  const db = requestDb(session.auth.token);

  const { data: teacher, error } = await db
    .from("app_users")
    .insert({
      org_id: session.auth.claims.org_id,
      full_name: parsed.data.full_name,
      role: "teacher",
      pin_hash: pinHash,
      pin_set_at: new Date().toISOString(),
    })
    .select("id, full_name, role, is_active, created_at")
    .single();

  if (error || !teacher) return apiErr(500, "DB_ERROR", "Tarbiyachini qo'shib bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "teacher.create",
    entity: "app_users",
    entityId: teacher.id,
    after: { ...teacher, pin_hash: "[redacted]" },
    request,
  });

  return apiOk(teacher);
});
