import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { dayCloseSchema } from "@/lib/schemas/attendance";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { adminDb } from "@/lib/db/admin";
import { closeDay, RejectedOpError } from "@/lib/attendance/apply-op";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => null);
  const parsed = dayCloseSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;
  const userId = session.auth.claims.sub;
  const deviceId = session.auth.claims.device_id;

  try {
    const result = await closeDay(
      db,
      orgId,
      userId,
      deviceId,
      parsed.data.day_date,
      new Date().toISOString(),
    );

    if (!result.alreadyClosed) {
      await logAudit({
        orgId,
        actorId: userId,
        actorRole: session.auth.claims.user_role,
        action: "day.close",
        entity: "attendance_days",
        entityId: result.dayId,
        after: { day_date: parsed.data.day_date },
        request,
      });
    }

    const { data: day } = await adminDb()
      .from("attendance_days")
      .select("*")
      .eq("id", result.dayId)
      .maybeSingle();

    return apiOk({ day, already_closed: result.alreadyClosed });
  } catch (err) {
    if (err instanceof RejectedOpError) {
      return apiErr(409, "CLOSE_FAILED", "Kunni yopib bo'lmadi.", { reason: err.reason });
    }
    throw err;
  }
}
