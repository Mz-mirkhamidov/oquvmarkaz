import "server-only";
import { Pool } from "pg";

import { env } from "@/lib/env";

/**
 * `qalqon_auth` role — owns (bypasses RLS on) the Better Auth tables plus
 * `login_tokens`, `rate_limits`, `auth_events` (TZ v2 §5.3). Only auth code
 * (lib/auth/**) may import this. Never touch app tables (children,
 * attendance_*, ...) through this pool — use lib/db/app-pool.ts for those.
 *
 * `max: 3` — Vercel serverless functions each get their own small pool;
 * Supabase's transaction pooler (port 6543) does the real multiplexing.
 */
let pool: Pool | undefined;

export function authPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env().AUTH_DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}
