import { z } from "zod";

import { apiOk, apiErr } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { parentUpdateSchema } from "@/lib/schemas/parent";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiErr(400, "INVALID_PAYLOAD", "Noto'g'ri ID.");

  const body = parentUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumotlar noto'g'ri.", body.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;
  const { full_name, phone, notify_enabled, child_ids } = body.data;

  const { data: parent, error } = await db
    .from("parents")
    .update({ full_name, phone, notify_enabled })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();
  if (error || !parent) return apiErr(404, "NOT_FOUND", "Ota-ona topilmadi.");

  if (child_ids) {
    const { data: children } = await db.from("children").select("id").eq("org_id", orgId).in("id", child_ids);
    if (!children || children.length !== new Set(child_ids).size) {
      return apiErr(400, "INVALID_PAYLOAD", "Bola topilmadi.");
    }
    await db.from("parent_children").delete().eq("parent_id", id);
    const { error: linkError } = await db
      .from("parent_children")
      .insert(child_ids.map((child_id) => ({ parent_id: id, child_id })));
    if (linkError) return apiErr(500, "DB_ERROR", "Bolalarni bog'lab bo'lmadi.");
  }

  await logAudit({
    orgId,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "parent.update",
    entity: "parents",
    entityId: id,
    after: parent,
    request,
  });

  return apiOk(parent);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiErr(400, "INVALID_PAYLOAD", "Noto'g'ri ID.");

  const db = requestDb(session.auth.token);
  const { error } = await db
    .from("parents")
    .delete()
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id);
  if (error) return apiErr(500, "DB_ERROR", "O'chirib bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "parent.delete",
    entity: "parents",
    entityId: id,
  });

  return apiOk({ id });
}
