import { z } from "zod";

import { apiOk, apiErr } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { getMonthOverview } from "@/lib/state/month-overview";

export const runtime = "nodejs";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export async function GET(request: Request) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const month = new URL(request.url).searchParams.get("month");
  if (!month || !monthSchema.safeParse(month).success) {
    return apiErr(400, "INVALID_PAYLOAD", "Oy YYYY-MM formatida bo'lishi kerak.");
  }

  const db = requestDb(session.auth.token);
  const days = await getMonthOverview(db, session.auth.claims.org_id, month);
  return apiOk({ month, days });
}
