import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { syncPushSchema } from "@/lib/schemas/sync";
import type { SyncOpResult } from "@/lib/schemas/sync";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { adminDb } from "@/lib/db/admin";
import { applyOp } from "@/lib/attendance/apply-op";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireAuth();
  if (!session.ok) return session.response;
  const { org_id: orgId, sub: userId } = session.auth.claims;

  const withinLimit = await checkRateLimit(`sync:org:${orgId}`, 60, 60);
  if (!withinLimit) {
    return apiErr(429, "RATE_LIMITED", "Juda ko'p so'rov. Biroz kutib qayta urinib ko'ring.");
  }

  const json = await request.json().catch(() => null);
  const parsed = syncPushSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const admin = adminDb();
  const { data: device } = await admin
    .from("devices")
    .select("id, is_blocked")
    .eq("org_id", orgId)
    .eq("device_key", parsed.data.device_key)
    .maybeSingle();
  if (device?.is_blocked) {
    return apiErr(403, "DEVICE_BLOCKED", "Bu qurilma bloklangan.");
  }

  const db = requestDb(session.auth.token);
  const results: SyncOpResult[] = [];

  for (const op of parsed.data.ops) {
    // sync_ops has no RLS policy for `authenticated` at all (0002_rls.sql)
    // — every read/write here has to go through service_role.
    const { data: existing } = await admin
      .from("sync_ops")
      .select("op_id")
      .eq("op_id", op.op_id)
      .maybeSingle();
    if (existing) {
      results.push({ op_id: op.op_id, status: "duplicate" });
      continue;
    }

    const outcome = await applyOp(op, {
      db,
      orgId,
      userId,
      deviceId: device?.id,
    });
    results.push(outcome);

    await admin.from("sync_ops").insert({
      op_id: op.op_id,
      org_id: orgId,
      device_id: device?.id ?? null,
      op_type: op.type,
      result: outcome.status,
      reason: outcome.status === "rejected" ? outcome.reason : null,
    });

    if (outcome.status === "applied") {
      await logAudit({
        orgId,
        actorId: userId,
        actorRole: session.auth.claims.user_role,
        action: op.type === "day.close" ? "day.close" : "record.mark",
        entity: op.type === "day.close" ? "attendance_days" : "attendance_records",
        entityId: "record_id" in outcome ? (outcome.record_id ?? null) : null,
        after: op.payload,
        request,
      });
    }
  }

  return apiOk({ server_time: new Date().toISOString(), results });
});
