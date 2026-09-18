import "server-only";

import { AUTH_MESSAGES, type AuthCode } from "@/lib/auth/errors";

/**
 * Better Auth endpoints (lib/auth/plugins/**) return through `ctx.json`,
 * which doesn't know about our app's `{ok, data}` / `{ok, error}` envelope
 * (lib/api/response.ts). Shaping responses this way keeps the existing
 * `apiPost`/`ApiClientError` client (lib/api/client.ts) working unchanged
 * for these endpoints too — no separate parsing path on the frontend.
 */
export function authEndpointError(code: AuthCode) {
  return { ok: false as const, error: { code, message: AUTH_MESSAGES[code] } };
}
