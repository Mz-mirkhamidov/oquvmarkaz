import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { orgUpdateSchema } from "@/lib/schemas/org";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => null);
  const parsed = orgUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const { data: before } = await db
    .from("organizations")
    .select("*")
    .eq("id", session.auth.claims.org_id)
    .maybeSingle();

  const { data: org, error } = await db
    .from("organizations")
    .update(parsed.data)
    .eq("id", session.auth.claims.org_id)
    .select("*")
    .single();

  if (error || !org) return apiErr(500, "DB_ERROR", "Saqlab bo'lmadi.");

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "org.update",
    entity: "organizations",
    entityId: org.id,
    before,
    after: org,
    request,
  });

  return apiOk(org);
}
