import { Bot } from "grammy";

/**
 * One-off deploy step (TZ §12 — no long-polling in production, webhook
 * only): points Telegram at /api/telegram/webhook and sets the secret
 * token Telegram must echo back on every call. Run after each deploy
 * whose URL changed:
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... NEXT_PUBLIC_APP_URL=https://... \
 *     pnpm telegram:set-webhook
 */
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !secretToken || !appUrl) {
    console.error("Missing TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, or NEXT_PUBLIC_APP_URL.");
    process.exit(1);
  }

  const bot = new Bot(token);
  const url = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  await bot.api.setWebhook(url, { secret_token: secretToken });
  const info = await bot.api.getWebhookInfo();
  console.log("Webhook set:", info);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
