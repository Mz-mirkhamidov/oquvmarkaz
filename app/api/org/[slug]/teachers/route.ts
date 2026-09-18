import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { adminDb } from "@/lib/db/admin";
import { authPool } from "@/lib/db/auth-pool";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Public (pre-auth) endpoint backing the PIN screen's "Kim ishlayapti?"
 * picker — a shared classroom tablet has no session yet, so it can only
 * know the org from its URL/localStorage-bound slug. Exposes nothing
 * beyond id + name, deliberately: no PINs, no contact info.
 *
 * TZ v2 §4.3 replaces this org-slug picker with a device bind-code +
 * cookie (A4) — kept for now so PIN login keeps working end-to-end; not
 * yet migrated to the device-aware flow.
 */
export const GET = withApiErrorBoundary(async (_request: Request, { params }: RouteParams) => {
  const { slug } = await params;

  const { data: org } = await adminDb().from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (!org) return apiErr(404, "ORG_NOT_FOUND", "Bog'cha topilmadi.");

  const { rows } = await authPool().query<{ id: string; full_name: string | null }>(
    `select id, "fullName" as full_name
       from "user"
      where "orgId" = $1 and "appRole" = 'teacher' and "isActive" = true
      order by "fullName" asc`,
    [org.id],
  );
  return apiOk(rows);
});
