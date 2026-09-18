import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth/session";
import { requestDb } from "@/lib/db/server";

export const runtime = "nodejs";

export const GET = withApiErrorBoundary(async () => {
  const auth = await getAuthContext();
  if (!auth) return apiErr(401, "NO_SESSION", "Sessiya topilmadi. Qayta kiring.");

  const db = requestDb(auth.token);

  const [{ data: org, error: orgError }, { data: user, error: userError }] = await Promise.all([
    db.from("organizations").select("*").eq("id", auth.claims.org_id).maybeSingle(),
    db
      .from("app_users")
      .select("id, full_name, role, org_id, telegram_username")
      .eq("id", auth.claims.sub)
      .maybeSingle(),
  ]);

  if (orgError || userError || !org || !user) {
    return apiErr(500, "DB_ERROR", "Hozir ulanib bo'lmadi.");
  }

  return apiOk({ org, user });
});
