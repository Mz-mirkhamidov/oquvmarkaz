import { z } from "zod";

import { apiOk, apiErr } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { getStateComparisonView } from "@/lib/state/day-comparison";
import { upsertStateChecks, StateCheckError } from "@/lib/state/apply-check";
import { stateChecksUpsertSchema } from "@/lib/schemas/state";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ date: string }>;
}

function parseDate(date: string) {
  return z.iso.date().safeParse(date).success;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { date } = await params;
  if (!parseDate(date)) {
    return apiErr(400, "INVALID_PAYLOAD", "Sana YYYY-MM-DD formatida bo'lishi kerak.");
  }

  const db = requestDb(session.auth.token);
  const view = await getStateComparisonView(db, session.auth.claims.org_id, date);
  return apiOk(view);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { date } = await params;
  if (!parseDate(date)) {
    return apiErr(400, "INVALID_PAYLOAD", "Sana YYYY-MM-DD formatida bo'lishi kerak.");
  }

  const body = stateChecksUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumotlar noto'g'ri.", body.error.flatten());
  }

  const db = requestDb(session.auth.token);
  let applied: Awaited<ReturnType<typeof upsertStateChecks>>;
  try {
    applied = await upsertStateChecks(
      db,
      session.auth.claims.org_id,
      session.auth.claims.sub,
      date,
      body.data,
    );
  } catch (err) {
    if (err instanceof StateCheckError && err.code === "DAY_NOT_FOUND") {
      return apiErr(404, "DAY_NOT_FOUND", "Bu kun uchun davomat hali ochilmagan.");
    }
    if (err instanceof StateCheckError && err.code === "CHILD_NOT_FOUND") {
      return apiErr(400, "INVALID_PAYLOAD", "Bola topilmadi.");
    }
    return apiErr(500, "SERVER_ERROR", "Saqlab bo'lmadi.");
  }

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "state_checks.upsert",
    entity: "attendance_day",
    entityId: applied.day_id,
    after: applied.rows,
    request,
  });

  const view = await getStateComparisonView(db, session.auth.claims.org_id, date);
  return apiOk(view);
}
