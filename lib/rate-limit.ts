import "server-only";

import { adminDb } from "@/lib/db/admin";

/**
 * Fixed-window rate limit backed by the `rate_limits` table and the
 * `hit_rate_limit` Postgres function (TZ §7.9 — plain-Postgres MVP
 * option). Returns true when the caller is still within the limit.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await adminDb().rpc("hit_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) {
    // Fail open on infra trouble — a missed rate limit is far cheaper
    // than blocking every request in the outage.
    console.error("rate_limit_error", error);
    return true;
  }
  return data === true;
}
