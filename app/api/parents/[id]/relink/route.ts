import { z } from "zod";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { generateLinkCode } from "@/lib/utils/link-code";
import { env } from "@/lib/env";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const LINK_CODE_TTL_DAYS = 7;
const MAX_CODE_RETRIES = 3;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** A parent lost/changed their device — issue a fresh one-time link code, unlinking the old chat. */
export const POST = withApiErrorBoundary(async (request: Request, { params }: RouteParams) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiErr(400, "INVALID_PAYLOAD", "Noto'g'ri ID.");

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;
  const linkCodeExpires = new Date(Date.now() + LINK_CODE_TTL_DAYS * 86_400_000).toISOString();

  let updated: { id: string; link_code: string | null } | null = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES && !updated; attempt++) {
    const { data, error } = await db
      .from("parents")
      .update({
        link_code: generateLinkCode(),
        link_code_expires: linkCodeExpires,
        linked_at: null,
        telegram_chat_id: null,
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id, link_code")
      .single();
    if (data) updated = data;
    else if (error?.code !== "23505") return apiErr(404, "NOT_FOUND", "Ota-ona topilmadi.");
  }
  if (!updated) return apiErr(500, "DB_ERROR", "Havola kodi yaratib bo'lmadi, qayta urinib ko'ring.");

  await logAudit({
    orgId,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "parent.relink",
    entity: "parents",
    entityId: id,
    request,
  });

  return apiOk({
    id: updated.id,
    link_code: updated.link_code,
    link_url: `https://t.me/${env().TELEGRAM_BOT_USERNAME}?start=${updated.link_code}`,
  });
});
