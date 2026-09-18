import { apiOk, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { authPool } from "@/lib/db/auth-pool";

export const runtime = "nodejs";

export interface SessionListItem {
  id: string;
  userId: string;
  userName: string | null;
  userRole: string | null;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

/** TZ v2 A5 — "rahbar kim qayerdan kirganini ko'radi": org-scoped active sessions. */
export const GET = withApiErrorBoundary(async () => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { rows } = await authPool().query<{
    id: string;
    userId: string;
    fullName: string | null;
    appRole: string | null;
    deviceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    expiresAt: string;
  }>(
    `select s.id, s."userId", u."fullName", u."appRole", s."deviceId",
            s."ipAddress", s."userAgent", s."createdAt", s."expiresAt"
       from "session" s
       join "user" u on u.id = s."userId"
      where u."orgId" = $1
      order by s."createdAt" desc
      limit 100`,
    [session.auth.claims.org_id],
  );

  const data: SessionListItem[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.fullName,
    userRole: r.appRole,
    deviceId: r.deviceId,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));

  return apiOk(data);
});
