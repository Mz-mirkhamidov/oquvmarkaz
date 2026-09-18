import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { authPool } from "@/lib/db/auth-pool";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** TZ v2 A5 — manager revokes a single session (org-scoped via the user join). */
export const DELETE = withApiErrorBoundary(async (request: Request, { params }: RouteParams) => {
  const session = await requireManager();
  if (!session.ok) return session.response;
  const { id } = await params;

  const { rows } = await authPool().query<{ id: string; userId: string }>(
    `delete from "session" s
       using "user" u
      where s.id = $1 and s."userId" = u.id and u."orgId" = $2
      returning s.id, s."userId"`,
    [id, session.auth.claims.org_id],
  );
  const revoked = rows[0];
  if (!revoked) return apiErr(404, "NOT_FOUND", "Sessiya topilmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "session.revoke",
    entity: "session",
    entityId: revoked.id,
    request,
  });

  return apiOk({ id: revoked.id, revoked: true });
});
