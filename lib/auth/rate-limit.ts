import "server-only";

import { authPool } from "@/lib/db/auth-pool";

/**
 * TZ v2 §10 — atomic fixed-window rate limit, reusing the
 * `hit_rate_limit()` function already defined in 0003_auth.sql (its
 * `rate_limits` table shape is untouched by this rebuild). Returns false
 * once `max` hits land inside the current `windowSec` window for `key`.
 */
export async function allow(key: string, max: number, windowSec: number): Promise<boolean> {
  const { rows } = await authPool().query<{ hit_rate_limit: boolean }>(
    "select hit_rate_limit($1, $2, $3) as hit_rate_limit",
    [key, windowSec, max],
  );
  return rows[0]?.hit_rate_limit ?? true;
}
