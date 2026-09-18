import { webhookCallback } from "grammy";

import { withApiErrorBoundary } from "@/lib/api/response";
import { getBot } from "@/lib/telegram/bot";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Telegram calls this directly (no user session, no cookies) — the only
 * gate is the secret token Telegram echoes back on every request, set via
 * setWebhook's secret_token (see scripts/set-telegram-webhook.ts).
 */
export const POST = withApiErrorBoundary(async (request: Request) => {
  const handler = webhookCallback(getBot(), "std/http", {
    secretToken: env().TELEGRAM_WEBHOOK_SECRET,
  });
  return handler(request);
});
