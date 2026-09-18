import "server-only";

import { authPool } from "@/lib/db/auth-pool";
import type { AuthCode } from "@/lib/auth/errors";

export type AuthStage = "bot" | "token" | "pin" | "device" | "session";

export interface AuthEvent {
  code: AuthCode | "LOGIN_OK" | "REGISTER_OK";
  stage: AuthStage;
  ok: boolean;
  userId?: string;
  orgId?: string;
  telegramId?: number | string;
  deviceId?: string;
  ip?: string | null;
  userAgent?: string | null;
  /** TZ v2 §11.1 — never a token, PIN, cookie value, or bot token. */
  detail?: Record<string, unknown>;
}

/**
 * TZ v2 X5/§11.1 — every auth attempt, success or failure, lands here so
 * "invalid" never again means "we don't know why". Best-effort: a logging
 * failure must never fail the auth flow itself, so errors are swallowed
 * (and reported to the structured console log instead, TZ v2 §11.3).
 */
export async function logAuthEvent(evt: AuthEvent): Promise<void> {
  try {
    await authPool().query(
      `insert into auth_events
         (code, stage, ok, user_id, org_id, telegram_id, device_id, ip, user_agent, detail)
       values ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9, $10::jsonb)`,
      [
        evt.code,
        evt.stage,
        evt.ok,
        evt.userId ?? null,
        evt.orgId ?? null,
        evt.telegramId != null ? String(evt.telegramId) : null,
        evt.deviceId ?? null,
        evt.ip ?? null,
        evt.userAgent ?? null,
        JSON.stringify(evt.detail ?? {}),
      ],
    );
  } catch (err) {
    console.error("auth_events_write_failed", err);
  }

  console.log(
    JSON.stringify({
      evt: "auth",
      stage: evt.stage,
      code: evt.code,
      ok: evt.ok,
      tg: evt.telegramId,
    }),
  );
}
