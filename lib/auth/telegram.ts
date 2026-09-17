import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const MAX_AUTH_AGE_SECONDS = 5 * 60;

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export type TelegramVerifyResult =
  | { ok: true; user: TelegramUser; authDate: number }
  | { ok: false; reason: "bad_hash" | "expired" | "malformed" };

/**
 * Verifies Telegram `initData` per TZ §7.3 / §11.2: HMAC-SHA256 against
 * the bot token, reject if `auth_date` is older than 5 minutes (replay
 * protection). Runs in the Node runtime only — needs `node:crypto`.
 */
export function verifyTelegramInitData(initDataRaw: string): TelegramVerifyResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initDataRaw);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "malformed" };
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData")
    .update(env().TELEGRAM_BOT_TOKEN)
    .digest();
  const computedHash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : NaN;
  if (!Number.isFinite(authDate)) return { ok: false, reason: "malformed" };
  if (Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "malformed" };

  try {
    const parsed = JSON.parse(userRaw) as Partial<TelegramUser>;
    if (typeof parsed.id !== "number" || typeof parsed.first_name !== "string") {
      return { ok: false, reason: "malformed" };
    }
    return {
      ok: true,
      authDate,
      user: {
        id: parsed.id,
        first_name: parsed.first_name,
        last_name: parsed.last_name,
        username: parsed.username,
        photo_url: parsed.photo_url,
      },
    };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
