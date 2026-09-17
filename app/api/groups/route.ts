import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { groupCreateSchema } from "@/lib/schemas/group";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const db = requestDb(session.auth.token);
  const { data, error } = await db
    .from("groups")
    .select("*")
    .eq("org_id", session.auth.claims.org_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => null);
  const parsed = groupCreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);

  if (parsed.data.teacher_id) {
    const { data: teacher } = await db
      .from("app_users")
      .select("id")
      .eq("id", parsed.data.teacher_id)
      .eq("org_id", session.auth.claims.org_id)
      .eq("role", "teacher")
      .maybeSingle();
    if (!teacher) return apiErr(400, "INVALID_TEACHER", "Bunday tarbiyachi topilmadi.");
  }

  const { data: group, error } = await db
    .from("groups")
    .insert({ ...parsed.data, org_id: session.auth.claims.org_id })
    .select("*")
    .single();

  if (error || !group) return apiErr(500, "DB_ERROR", "Guruh yaratib bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "group.create",
    entity: "groups",
    entityId: group.id,
    after: group,
    request,
  });

  return apiOk(group);
}
