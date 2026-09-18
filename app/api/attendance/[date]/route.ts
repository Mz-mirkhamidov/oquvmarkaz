import { z } from "zod";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { getDayView } from "@/lib/attendance/day-view";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ date: string }>;
}

export const GET = withApiErrorBoundary(async (_request: Request, { params }: RouteParams) => {
  const session = await requireAuth();
  if (!session.ok) return session.response;

  const { date } = await params;
  if (!z.iso.date().safeParse(date).success) {
    return apiErr(400, "INVALID_PAYLOAD", "Sana YYYY-MM-DD formatida bo'lishi kerak.");
  }

  const db = requestDb(session.auth.token);
  const view = await getDayView(db, session.auth.claims.org_id, date);

  return apiOk({ ...view, date });
});
