import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { todayInTashkent } from "@/lib/utils/date";

export const runtime = "nodejs";

/**
 * TZ §7.6 — incremental pull for the offline client: anything changed
 * since `since` (children/groups/org/users), plus always today's
 * attendance so a freshly-opened tab reflects what other devices marked.
 */
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (!session.ok) return session.response;
  const { org_id: orgId } = session.auth.claims;

  const since = request.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  if (since && (!sinceDate || Number.isNaN(sinceDate.getTime()))) {
    return apiErr(400, "INVALID_PAYLOAD", "`since` ISO 8601 formatida bo'lishi kerak.");
  }

  const db = requestDb(session.auth.token);
  const serverTime = new Date().toISOString();

  let orgQuery = db.from("organizations").select("*").eq("id", orgId);
  let childrenQuery = db.from("children").select("*").eq("org_id", orgId).eq("is_active", true);
  let groupsQuery = db.from("groups").select("*").eq("org_id", orgId).eq("is_active", true);
  const usersQuery = db
    .from("app_users")
    .select("id, full_name, role, is_active, telegram_username")
    .eq("org_id", orgId);

  if (since) {
    childrenQuery = childrenQuery.gt("updated_at", since);
    groupsQuery = groupsQuery.gt("updated_at", since);
    orgQuery = orgQuery.gt("updated_at", since);
  }

  const today = todayInTashkent();
  const { data: day } = await db
    .from("attendance_days")
    .select("id")
    .eq("org_id", orgId)
    .eq("day_date", today)
    .maybeSingle();

  const [org, children, groups, users, records] = await Promise.all([
    orgQuery.maybeSingle(),
    childrenQuery,
    groupsQuery,
    usersQuery,
    day
      ? db.from("attendance_records").select("*").eq("day_id", day.id).eq("is_current", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return apiOk({
    server_time: serverTime,
    cursor: serverTime,
    org: org.data,
    children: children.data ?? [],
    groups: groups.data ?? [],
    users: users.data ?? [],
    attendance_records: records.data ?? [],
    today,
  });
}
