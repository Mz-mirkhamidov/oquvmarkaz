import { apiOk, withApiErrorBoundary } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { getDayView } from "@/lib/attendance/day-view";
import { todayInTashkent } from "@/lib/utils/date";

export const runtime = "nodejs";

export const GET = withApiErrorBoundary(async () => {
  const session = await requireAuth();
  if (!session.ok) return session.response;

  const db = requestDb(session.auth.token);
  const today = todayInTashkent();
  const view = await getDayView(db, session.auth.claims.org_id, today);

  return apiOk({ ...view, date: today, server_time: new Date().toISOString() });
});
