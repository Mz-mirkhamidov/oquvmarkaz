import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { disputeCreateSchema } from "@/lib/schemas/dispute";
import { createDispute, DisputeCreateError } from "@/lib/disputes/create";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const GET = withApiErrorBoundary(async (request: Request) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const month = new URL(request.url).searchParams.get("month");

  const db = requestDb(session.auth.token);
  let query = db
    .from("disputes")
    .select("*")
    .eq("org_id", session.auth.claims.org_id)
    .order("created_at", { ascending: false });
  if (month) query = query.eq("period_month", `${month}-01`);

  const { data, error } = await query;
  if (error) return apiErr(500, "DB_ERROR", "Yuklab bo'lmadi.");
  return apiOk(data ?? []);
});

export const POST = withApiErrorBoundary(async (request: Request) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const body = disputeCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumotlar noto'g'ri.", body.error.flatten());
  }

  const db = requestDb(session.auth.token);
  let dispute;
  try {
    dispute = await createDispute(db, session.auth.claims.org_id, session.auth.claims.sub, body.data);
  } catch (err) {
    if (err instanceof DisputeCreateError && err.code === "NO_MISMATCHES") {
      return apiErr(400, "INVALID_PAYLOAD", "Tanlangan yozuvlar nomuvofiqlik emas.");
    }
    if (err instanceof DisputeCreateError && err.code === "ALREADY_CLAIMED") {
      return apiErr(409, "ALREADY_CLAIMED", "Ba'zi yozuvlar boshqa da'voga biriktirilgan.");
    }
    return apiErr(500, "DB_ERROR", "Da'vo yaratib bo'lmadi.");
  }

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "dispute.create",
    entity: "disputes",
    entityId: dispute.id,
    after: dispute,
    request,
  });

  return apiOk(dispute, 201);
});
