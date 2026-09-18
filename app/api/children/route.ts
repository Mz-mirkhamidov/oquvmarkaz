import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { childCreateSchema, childUpdateSchema } from "@/lib/schemas/child";
import { requireAuth, requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const GET = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireAuth();
  if (!session.ok) return session.response;

  const groupId = request.nextUrl.searchParams.get("group_id");
  const db = requestDb(session.auth.token);
  let query = db
    .from("children")
    .select("*")
    .eq("org_id", session.auth.claims.org_id)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (groupId) query = query.eq("group_id", groupId);

  // RLS additionally restricts a teacher to their own group's children —
  // this query returns whatever it's allowed to see either way.
  const { data, error } = await query;
  if (error) return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
  return apiOk(data);
});

export const POST = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => null);
  const parsed = childCreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);

  if (parsed.data.group_id) {
    const { data: group } = await db
      .from("groups")
      .select("id")
      .eq("id", parsed.data.group_id)
      .eq("org_id", session.auth.claims.org_id)
      .maybeSingle();
    if (!group) return apiErr(400, "INVALID_GROUP", "Bunday guruh topilmadi.");
  }

  const { photo_consent, ...rest } = parsed.data;
  const { data: child, error } = await db
    .from("children")
    .insert({
      ...rest,
      org_id: session.auth.claims.org_id,
      photo_consent: photo_consent ?? false,
      photo_consent_at: photo_consent ? new Date().toISOString() : null,
      photo_consent_by: photo_consent ? session.auth.claims.sub : null,
    })
    .select("*")
    .single();

  if (error || !child) return apiErr(500, "DB_ERROR", "Bolani qo'shib bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "child.create",
    entity: "children",
    entityId: child.id,
    after: child,
    request,
  });

  return apiOk(child);
});

export const PATCH = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return apiErr(400, "INVALID_PAYLOAD", "Bola ID'si ko'rsatilmagan.");

  const json = await request.json().catch(() => null);
  const parsed = childUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const { data: before } = await db
    .from("children")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .maybeSingle();
  if (!before) return apiErr(404, "NOT_FOUND", "Bola topilmadi.");

  const { photo_consent, ...rest } = parsed.data;
  const consentChanged = photo_consent !== undefined && photo_consent !== before.photo_consent;

  const { data: child, error } = await db
    .from("children")
    .update({
      ...rest,
      ...(consentChanged
        ? {
            photo_consent,
            photo_consent_at: photo_consent ? new Date().toISOString() : null,
            photo_consent_by: photo_consent ? session.auth.claims.sub : null,
          }
        : {}),
    })
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .select("*")
    .single();

  if (error || !child) return apiErr(500, "DB_ERROR", "Saqlab bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "child.update",
    entity: "children",
    entityId: child.id,
    before,
    after: child,
    request,
  });

  return apiOk(child);
});
