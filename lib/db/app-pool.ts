import "server-only";
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";

import { env } from "@/lib/env";

/**
 * `qalqon_app` role — RLS-constrained (TZ v2 §3.2). Auth code only uses
 * this for `devices`, the one app table it owns; every other app table
 * (children, attendance_*, ...) stays on the existing supabase-js/PostgREST
 * path (lib/db/admin.ts, lib/db/server.ts) — out of this rebuild's scope.
 */
export interface DevicesTable {
  id: string;
  org_id: string;
  label: string | null;
  secret_hash: string;
  bind_code: string | null;
  bind_expires: Date | null;
  bound_at: Date | null;
  last_seen_at: Date | null;
  user_agent: string | null;
  is_blocked: boolean;
  created_by: string | null;
  created_at: Date;
}

export interface AppDatabase {
  devices: DevicesTable;
}

let pool: Pool | undefined;
let db: Kysely<AppDatabase> | undefined;

export function appDb(): Kysely<AppDatabase> {
  if (!db) {
    if (!pool) {
      pool = new Pool({
        connectionString: env().DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 10_000,
      });
    }
    db = new Kysely<AppDatabase>({ dialect: new PostgresDialect({ pool }) });
  }
  return db;
}
