import { apiOk, apiErr } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { parentCreateSchema } from "@/lib/schemas/parent";
import { generateLinkCode } from "@/lib/utils/link-code";
import { env } from "@/lib/env";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const LINK_CODE_TTL_DAYS = 7;
const MAX_CODE_RETRIES = 3;

export async function GET() {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const db = requestDb(session.auth.token);
  const { data: parents, error } = await db
    .from("parents")
    .select("id, full_name, phone, notify_enabled, linked_at, link_code, link_code_expires, parent_children(child_id, children(full_name))")
    .eq("org_id", session.auth.claims.org_id)
    .order("full_name", { ascending: true });
  if (error) return apiErr(500, "DB_ERROR", "Yuklab bo'lmadi.");

  return apiOk(
    (parents ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      notify_enabled: p.notify_enabled,
      linked: !!p.linked_at,
      link_code: p.link_code,
      link_code_expires: p.link_code_expires,
      children: (p.parent_children ?? [])
        .map((pc) => (pc.children as unknown as { full_name: string } | null)?.full_name)
        .filter((n): n is string => !!n),
    })),
  );
}

export async function POST(request: Request) {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const body = parentCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumotlar noto'g'ri.", body.error.flatten());
  }

  const db = requestDb(session.auth.token);
  const orgId = session.auth.claims.org_id;

  const { data: children } = await db
    .from("children")
    .select("id")
    .eq("org_id", orgId)
    .in("id", body.data.child_ids);
  if (!children || children.length !== new Set(body.data.child_ids).size) {
    return apiErr(400, "INVALID_PAYLOAD", "Bola topilmadi.");
  }

  const linkCodeExpires = new Date(Date.now() + LINK_CODE_TTL_DAYS * 86_400_000).toISOString();
  let parent: { id: string; link_code: string | null } | null = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES && !parent; attempt++) {
    const { data, error } = await db
      .from("parents")
      .insert({
        org_id: orgId,
        full_name: body.data.full_name,
        phone: body.data.phone ?? null,
        notify_enabled: body.data.notify_enabled ?? true,
        link_code: generateLinkCode(),
        link_code_expires: linkCodeExpires,
      })
      .select("id, link_code")
      .single();
    if (data) parent = data;
    else if (error?.code !== "23505") return apiErr(500, "DB_ERROR", "Ota-ona qo'shib bo'lmadi.");
  }
  if (!parent) return apiErr(500, "DB_ERROR", "Havola kodi yaratib bo'lmadi, qayta urinib ko'ring.");

  const { error: linkError } = await db
    .from("parent_children")
    .insert(body.data.child_ids.map((child_id) => ({ parent_id: parent!.id, child_id })));
  if (linkError) return apiErr(500, "DB_ERROR", "Bolalarni bog'lab bo'lmadi.");

  await logAudit({
    orgId,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "parent.create",
    entity: "parents",
    entityId: parent.id,
    request,
  });

  return apiOk(
    {
      id: parent.id,
      link_code: parent.link_code,
      link_url: `https://t.me/${env().TELEGRAM_BOT_USERNAME}?start=${parent.link_code}`,
    },
    201,
  );
}
