import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { teacherPinResetSchema } from "@/lib/schemas/teacher";
import { requireManager } from "@/lib/auth/guard";
import { authPool } from "@/lib/db/auth-pool";
import { hashPin } from "@/lib/auth/pin-hash";
import { logAudit } from "@/lib/audit";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

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

  const pool = authPool();
  const { rows: existing } = await pool.query<{ id: string }>(
    `select id from "user" where id = $1 and "orgId" = $2 and "appRole" = 'teacher'`,
    [id, session.auth.claims.org_id],
  );
  if (!existing[0]) return apiErr(404, "NOT_FOUND", "Tarbiyachi topilmadi.");

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (parsed.data.pin) {
    sets.push(`"pinHash" = $${i++}`, `"failedPinCount" = 0`, `"lockedUntil" = null`);
    values.push(await hashPin(parsed.data.pin));
  }
  if (parsed.data.is_active !== undefined) {
    sets.push(`"isActive" = $${i++}`);
    values.push(parsed.data.is_active);
  }
  if (sets.length === 0) {
    return apiErr(400, "INVALID_PAYLOAD", "Hech narsa o'zgartirilmadi.");
  }

  values.push(id);
  const { rows } = await pool.query<{
    id: string;
    full_name: string | null;
    role: string | null;
    is_active: boolean | null;
  }>(
    `update "user" set ${sets.join(", ")}
       where id = $${i}
     returning id, "fullName" as full_name, "appRole" as role, "isActive" as is_active`,
    values,
  );
  const teacher = rows[0];
  if (!teacher) return apiErr(500, "DB_ERROR", AUTH_MESSAGES.DB_ERROR);

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: parsed.data.pin ? "teacher.pin_reset" : "teacher.update",
    entity: "user",
    entityId: teacher.id,
    request,
  });

  return apiOk(teacher);
});
