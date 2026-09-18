import "server-only";
import { sql } from "kysely";

import { appDb, type AppDatabase } from "@/lib/db/app-pool";
import type { UserRole } from "@/lib/db/types";

export interface OrgContext {
  orgId: string;
  userId: string;
  role: UserRole;
}

/**
 * Every query against an app table `qalqon_app` has RLS policies for
 * (currently: `devices`) must go through this — it sets
 * `request.jwt.claims` for the duration of one transaction, exactly the
 * GUC 0002_rls.sql's `auth_org_id()`/`auth_user_id()`/`auth_user_role()`
 * already read (TZ v2 §3.3), so the same policies apply as they did when
 * PostgREST set that GUC from a JWT.
 */
export async function withOrg<T>(
  ctx: OrgContext,
  fn: (tx: import("kysely").Transaction<AppDatabase>) => Promise<T>,
): Promise<T> {
  return appDb()
    .transaction()
    .execute(async (tx) => {
      await sql`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: ctx.userId,
        org_id: ctx.orgId,
        user_role: ctx.role,
      })}, true)`.execute(tx);
      return fn(tx);
    });
}
