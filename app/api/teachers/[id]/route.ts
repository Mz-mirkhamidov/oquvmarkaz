import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { teacherPinResetSchema } from "@/lib/schemas/teacher";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { hashPin } from "@/lib/auth/pin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  pin: teacherPinResetSchema.shape.pin.optional(),
  is_active: z.boolean().optional(),
});

export const PATCH = withApiErrorBoundary(async (request: NextRequest, { params }: RouteParams) => {
  const session = await requireManager();
  if (!session.ok) return session.response;
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const { data: before } = await db
    .from("app_users")
    .select("id, org_id, role")
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .eq("role", "teacher")
    .maybeSingle();
  if (!before) return apiErr(404, "NOT_FOUND", "Tarbiyachi topilmadi.");

  const update: {
    pin_hash?: string;
    pin_set_at?: string;
    failed_pin_count?: number;
    locked_until?: string | null;
    is_active?: boolean;
  } = {};
  if (parsed.data.pin) {
    update.pin_hash = await hashPin(parsed.data.pin);
    update.pin_set_at = new Date().toISOString();
    update.failed_pin_count = 0;
    update.locked_until = null;
  }
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

  const { data: teacher, error } = await db
    .from("app_users")
    .update(update)
    .eq("id", id)
    .eq("org_id", session.auth.claims.org_id)
    .select("id, full_name, role, is_active")
    .single();

  if (error || !teacher) return apiErr(500, "DB_ERROR", "Saqlab bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: parsed.data.pin ? "teacher.pin_reset" : "teacher.update",
    entity: "app_users",
    entityId: teacher.id,
    request,
  });

  return apiOk(teacher);
});
