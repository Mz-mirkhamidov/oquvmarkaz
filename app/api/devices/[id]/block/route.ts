import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { withOrg } from "@/lib/db/with-org";
import { authPool } from "@/lib/db/auth-pool";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * TZ v2 §4.4 — blocking a device immediately revokes every session bound
 * to it (session.deviceId), not just future PIN attempts.
 */
export const POST = withApiErrorBoundary(async (request: Request, { params }: RouteParams) => {
  const session = await requireManager();
  if (!session.ok) return session.response;
  const { id } = await params;

  const ctx = {
    orgId: session.auth.claims.org_id,
    userId: session.auth.claims.sub,
    role: session.auth.claims.user_role,
  };

  const updated = await withOrg(ctx, (tx) =>
    tx
      .updateTable("devices")
      .set({ is_blocked: true })
      .where("id", "=", id)
      .returning("id")
      .executeTakeFirst(),
  );
  if (!updated) return apiErr(404, "NOT_FOUND", "Qurilma topilmadi.");

  await authPool().query(`delete from "session" where "deviceId" = $1`, [id]);

  await logAudit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: "device.block",
    entity: "devices",
    entityId: id,
    request,
  });

  return apiOk({ id, blocked: true });
});
