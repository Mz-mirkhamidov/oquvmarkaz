import { z } from "zod";

import { apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { getMonthlyReportData } from "@/lib/reports/monthly-data";
import { buildMonthlyWorkbook } from "@/lib/reports/monthly-xlsx";

export const runtime = "nodejs";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const GET = withApiErrorBoundary(async (request: Request) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const month = new URL(request.url).searchParams.get("month");
  if (!month || !monthSchema.safeParse(month).success) {
    return apiErr(400, "INVALID_PAYLOAD", "Oy YYYY-MM formatida bo'lishi kerak.");
  }

  const db = requestDb(session.auth.token);
  const data = await getMonthlyReportData(db, session.auth.claims.org_id, month);
  const buffer = await buildMonthlyWorkbook(data);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="davomat-${month}.xlsx"`,
    },
  });
});
