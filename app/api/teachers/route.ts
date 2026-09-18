import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { teacherCreateSchema } from "@/lib/schemas/teacher";
import { requireManager } from "@/lib/auth/guard";
import { authPool } from "@/lib/db/auth-pool";
import { hashPin } from "@/lib/auth/pin-hash";
import { logAudit } from "@/lib/audit";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

export const runtime = "nodejs";

interface TeacherRow {
  id: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  last_seen_at: string | null;
  created_at: string;
}

export const GET = withApiErrorBoundary(async () => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { rows } = await authPool().query<TeacherRow>(
    `select id, "fullName" as full_name, "appRole" as role, "isActive" as is_active,
            null as last_seen_at, "createdAt" as created_at
       from "user"
      where "orgId" = $1 and "appRole" = 'teacher'
      order by "fullName" asc`,
    [session.auth.claims.org_id],
  );
  return apiOk(rows);
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

  const { rows } = await authPool().query<TeacherRow>(
    `insert into "user" (email, name, "emailVerified", "fullName", "appRole", "orgId", "pinHash", "isActive", "failedPinCount")
     values ($1, $2, true, $2, 'teacher', $3, $4, true, 0)
     returning id, "fullName" as full_name, "appRole" as role, "isActive" as is_active, "createdAt" as created_at`,
    [teacherEmail(), parsed.data.full_name, session.auth.claims.org_id, pinHash],
  );
  const teacher = rows[0];
  if (!teacher) return apiErr(500, "DB_ERROR", AUTH_MESSAGES.DB_ERROR);

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "teacher.create",
    entity: "user",
    entityId: teacher.id,
    after: { ...teacher },
    request,
  });

  return apiOk(teacher);
});

function teacherEmail(): string {
  return `teacher-${crypto.randomUUID()}@qalqon.local`;
}
