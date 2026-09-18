import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { dayReopenSchema } from "@/lib/schemas/attendance";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => null);
  const parsed = dayReopenSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;

  const { data: day } = await db
    .from("attendance_days")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("day_date", parsed.data.day_date)
    .maybeSingle();
  if (!day) return apiErr(404, "NOT_FOUND", "Bu kun uchun yozuv topilmadi.");
  if (day.status !== "closed") {
    return apiErr(409, "NOT_CLOSED", "Bu kun yopilmagan.");
  }

  const { data: updated, error } = await db
    .from("attendance_days")
    .update({
      status: "reopened",
      reopen_reason: parsed.data.reason,
      reopened_at: new Date().toISOString(),
      reopened_by: session.auth.claims.sub,
    })
    .eq("id", day.id)
    .select("*")
    .single();
  if (error || !updated) return apiErr(500, "DB_ERROR", "Qayta ochib bo'lmadi.");

  await logAudit({
    orgId,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "day.reopen",
    entity: "attendance_days",
    entityId: day.id,
    after: { reason: parsed.data.reason },
    request,
  });

  return apiOk(updated);
});
