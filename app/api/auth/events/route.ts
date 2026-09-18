import { apiOk, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { authPool } from "@/lib/db/auth-pool";

export const runtime = "nodejs";

export interface AuthEventListItem {
  id: string;
  at: string;
  code: string;
  stage: string;
  ok: boolean;
  userId: string | null;
  deviceId: string | null;
  ip: string | null;
}

/** TZ v2 §11.1 — "Xavfsizlik" panel: last 100 auth events for this org. */
export const GET = withApiErrorBoundary(async () => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { rows } = await authPool().query<AuthEventListItem>(
    `select id::text, at, code, stage, ok, user_id as "userId", device_id::text as "deviceId", host(ip) as ip
       from auth_events
      where org_id = $1
      order by at desc
      limit 100`,
    [session.auth.claims.org_id],
  );

  return apiOk(rows);
});
