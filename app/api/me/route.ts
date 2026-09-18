import { headers } from "next/headers";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { getAuth } from "@/lib/auth";
import { adminDb } from "@/lib/db/admin";
import { AUTH_MESSAGES } from "@/lib/auth/errors";
import type { UserRole } from "@/lib/db/types";

export const runtime = "nodejs";

export const GET = withApiErrorBoundary(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return apiErr(401, "NO_SESSION", AUTH_MESSAGES.NO_SESSION);

  const user = session.user as typeof session.user & {
    orgId: string | null;
    appRole: UserRole | null;
    fullName: string | null;
    telegramUsername: string | null;
  };

  // Not registered yet (TZ v2 §4.2) — /sozlash treats any /api/me failure
  // as "start the wizard from step 1", so this doesn't need its own code.
  if (!user.orgId || !user.appRole) {
    return apiErr(403, "NO_ORG", AUTH_MESSAGES.NO_ORG);
  }

  const { data: org, error } = await adminDb()
    .from("organizations")
    .select("*")
    .eq("id", user.orgId)
    .maybeSingle();
  if (error || !org) {
    return apiErr(500, "DB_ERROR", AUTH_MESSAGES.DB_ERROR);
  }

  return apiOk({
    org,
    user: {
      id: user.id,
      full_name: user.fullName,
      role: user.appRole,
      org_id: user.orgId,
      telegram_username: user.telegramUsername,
    },
  });
});
