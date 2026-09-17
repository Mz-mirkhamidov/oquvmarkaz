import { apiOk, apiErr } from "@/lib/api/response";
import { adminDb } from "@/lib/db/admin";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Public (pre-auth) endpoint backing the PIN screen's "Kim ishlayapti?"
 * picker — a shared classroom tablet has no session yet, so it can only
 * know the org from its URL/localStorage-bound slug. Exposes nothing
 * beyond id + name, deliberately: no PINs, no contact info.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const db = adminDb();
  const { data: org } = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (!org) return apiErr(404, "ORG_NOT_FOUND", "Bog'cha topilmadi.");

  const { data, error } = await db
    .from("app_users")
    .select("id, full_name")
    .eq("org_id", org.id)
    .eq("role", "teacher")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
  return apiOk(data);
}
