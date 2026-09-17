import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { groupUpdateSchema } from "@/lib/schemas/group";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = groupUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const { data: before } = await db
    .from("groups")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .maybeSingle();
  if (!before) return apiErr(404, "NOT_FOUND", "Guruh topilmadi.");

  const { data: group, error } = await db
    .from("groups")
    .update(parsed.data)
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .select("*")
    .single();

  if (error || !group) return apiErr(500, "DB_ERROR", "Saqlab bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "group.update",
    entity: "groups",
    entityId: group.id,
    before,
    after: group,
    request,
  });

  return apiOk(group);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;
  const { id } = await params;

  const db = requestDb(session.auth.token);
  const { data: before } = await db
    .from("groups")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .maybeSingle();
  if (!before) return apiErr(404, "NOT_FOUND", "Guruh topilmadi.");

  // Soft delete — a group can be referenced by attendance history.
  const { error } = await db
    .from("groups")
    .update({ is_active: false })
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id);

  if (error) return apiErr(500, "DB_ERROR", "O'chirib bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "group.deactivate",
    entity: "groups",
    entityId: id,
    before,
    request,
  });

  return apiOk({ id, deactivated: true });
}
