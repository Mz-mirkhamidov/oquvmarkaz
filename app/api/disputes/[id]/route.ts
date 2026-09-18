import { z } from "zod";
import { randomBytes } from "node:crypto";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { disputeUpdateSchema } from "@/lib/schemas/dispute";
import { getDisputeEvidence } from "@/lib/disputes/evidence";
import { renderDisputePdf } from "@/lib/reports/dispute-pdf";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import type { Database } from "@/lib/db/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withApiErrorBoundary(async (_request: Request, { params }: RouteParams) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiErr(400, "INVALID_PAYLOAD", "Noto'g'ri ID.");

  const db = requestDb(session.auth.token);
  const evidence = await getDisputeEvidence(db, session.auth.claims.org_id, id);
  if (!evidence) return apiErr(404, "NOT_FOUND", "Da'vo topilmadi.");

  return apiOk(evidence);
});

export const PATCH = withApiErrorBoundary(async (request: Request, { params }: RouteParams) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiErr(400, "INVALID_PAYLOAD", "Noto'g'ri ID.");

  const body = disputeUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumotlar noto'g'ri.", body.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;

  const { data: existing } = await db
    .from("disputes")
    .select("id, status, bundle_path")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return apiErr(404, "NOT_FOUND", "Da'vo topilmadi.");

  const patch: Database["public"]["Tables"]["disputes"]["Update"] = { ...body.data };
  const submitting = body.data.status === "submitted" && existing.status !== "submitted";
  if (submitting) {
    patch.submitted_at = new Date().toISOString();
    patch.bundle_code = randomBytes(4).toString("hex").toUpperCase();
  }

  const { data: dispute, error } = await db
    .from("disputes")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();
  if (error || !dispute) return apiErr(500, "DB_ERROR", "Saqlab bo'lmadi.");

  if (submitting) {
    try {
      const evidence = await getDisputeEvidence(db, orgId, id);
      if (evidence) {
        const pdf = await renderDisputePdf(evidence);
        const path = `${orgId}/disputes/${id}.pdf`;
        await storage("reports").upload(path, pdf, "application/pdf");
        await db.from("disputes").update({ bundle_path: path }).eq("id", id);
        dispute.bundle_path = path;
      }
    } catch (err) {
      // The status change itself already succeeded and is the source of
      // truth; the bundle can be regenerated on-demand via the PDF route,
      // so a rendering hiccup here shouldn't roll back the submission.
      console.error("dispute_bundle_generation_failed", err);
    }
  }

  await logAudit({
    orgId,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "dispute.update",
    entity: "disputes",
    entityId: id,
    after: dispute,
    request,
  });

  return apiOk(dispute);
});
