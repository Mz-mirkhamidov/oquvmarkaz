import { z } from "zod";

import { apiErr } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { getDisputeEvidence } from "@/lib/disputes/evidence";
import { renderDisputePdf } from "@/lib/reports/dispute-pdf";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * A submitted dispute's bundle is frozen (its bundle_code is what gets
 * quoted to the state system), so this redirects to the stored copy once
 * one exists. A draft has none yet — render on the fly so the director
 * can preview the bundle before submitting.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiErr(400, "INVALID_PAYLOAD", "Noto'g'ri ID.");

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;

  const { data: dispute } = await db
    .from("disputes")
    .select("id, bundle_path")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!dispute) return apiErr(404, "NOT_FOUND", "Da'vo topilmadi.");

  if (dispute.bundle_path) {
    const url = await storage("reports").createReadUrl(dispute.bundle_path, { expiresIn: 300 });
    return Response.redirect(url, 302);
  }

  const evidence = await getDisputeEvidence(db, orgId, id);
  if (!evidence) return apiErr(404, "NOT_FOUND", "Da'vo topilmadi.");

  const pdf = await renderDisputePdf(evidence);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dispute-${id}.pdf"`,
    },
  });
}
