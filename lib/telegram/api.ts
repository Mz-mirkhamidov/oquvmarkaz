import "server-only";

import { env } from "@/lib/env";

const API_BASE = "https://api.telegram.org";

interface TelegramApiResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function callTelegramApi<T>(method: string): Promise<TelegramApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}/bot${env().TELEGRAM_BOT_TOKEN}/${method}`, {
      cache: "no-store",
    });
    return (await res.json()) as TelegramApiResult<T>;
  } catch (err) {
    // Network failure or a non-JSON body (e.g. a proxy's plain-text
    // rejection) — selftest (TZ v2 §11.2) needs this to degrade to a
    // reported problem, never a 500 that hides everything else it checked.
    return { ok: false, description: (err as Error).message };
  }
}

export interface TelegramMe {
  id: number;
  username: string;
}

export interface TelegramWebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

/** TZ v2 §11.2 selftest — confirms the configured bot token is live at all. */
export async function getMe(): Promise<TelegramApiResult<TelegramMe>> {
  return callTelegramApi<TelegramMe>("getMe");
}

/** TZ v2 §11.2/X7 — catches "token rotated, webhook now points nowhere". */
export async function getWebhookInfo(): Promise<TelegramApiResult<TelegramWebhookInfo>> {
  return callTelegramApi<TelegramWebhookInfo>("getWebhookInfo");
}
