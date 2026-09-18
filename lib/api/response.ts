import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiOk<T> | ApiErr;

/** Every response carries X-Server-Time (TZ §7.1.5) — clients never trust device time. */
function withServerTime(res: NextResponse): NextResponse {
  res.headers.set("X-Server-Time", new Date().toISOString());
  return res;
}

/**
 * 200 + `ok: true`. Also used for endpoints whose *business* outcome can
 * be negative (e.g. one op in a sync batch was rejected) — those still
 * respond 200 so the client can tell a network failure from a business
 * one (TZ §7.1.4); the per-item outcome lives inside `data`.
 */
export function apiOk<T>(data: T, init?: number): NextResponse<ApiOk<T>> {
  return withServerTime(
    NextResponse.json({ ok: true, data }, { status: init ?? 200 }),
  ) as NextResponse<ApiOk<T>>;
}

/**
 * A transport/protocol-level failure — bad input, missing auth, no
 * permission, not found, conflict, rate limited, or a server error.
 * Uses the real HTTP status (TZ §7.1.4).
 */
export function apiErr(
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErr> {
  return withServerTime(
    NextResponse.json({ ok: false, error: { code, message, details } }, { status }),
  ) as NextResponse<ApiErr>;
}

/**
 * Every route handler is wrapped in this. Without it, an uncaught
 * exception (a misconfigured env var, a bug, an upstream outage) falls
 * through to Next.js's own error handling, which is not guaranteed to
 * return JSON — the client's `apiFetch` then fails to parse the body and
 * shows a generic "network error" that hides the real cause. This turns
 * every unexpected failure into the same clean `ApiErr` shape everything
 * else on the client already knows how to handle.
 */
export function withApiErrorBoundary<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error("unhandled_api_error", err);
      return apiErr(
        500,
        "SERVER_ERROR",
        "Kutilmagan xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
      );
    }
  };
}
