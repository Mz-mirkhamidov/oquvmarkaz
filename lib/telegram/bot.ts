import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { Bot, type Context } from "grammy";

import { env } from "@/lib/env";
import { adminDb } from "@/lib/db/admin";
import { authPool } from "@/lib/db/auth-pool";
import { allow } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/events";

let cached: Bot | undefined;

/**
 * One bot instance per server process. `webhookCallback()` (the webhook
 * route) and `sendMessage()` (the outbox processor) both use this — the
 * bot never runs its own long-polling loop, so there's nothing to start.
 *
 * `/kirish` (or `/start web`, TZ v2 §4.1 Yo'nalish 2) is the owner/director
 * login trigger — issues a one-time login_tokens row, see A1/A2. Plain
 * `/start <code>` is the unrelated, pre-existing parent-notification link
 * flow (parents.link_code) and is untouched.
 */
export function getBot(): Bot {
  if (cached) return cached;

  const bot = new Bot(env().TELEGRAM_BOT_TOKEN);

  bot.command(["start", "kirish"], async (ctx) => {
    const isKirishCommand = ctx.message?.text?.startsWith("/kirish") ?? false;
    const arg = ctx.match?.trim();

    if (isKirishCommand || arg === "web") {
      await sendLoginLink(ctx);
      return;
    }

    if (!arg) {
      await ctx.reply(
        "Assalomu alaykum! Tizimga kirish uchun /kirish buyrug'ini yuboring, yoki farzandingiz davomati haqida xabar olish uchun bog'changiz sizga bergan havoladan foydalaning.",
      );
      return;
    }

    await handleParentLink(ctx, arg);
  });

  bot.on("message", async (ctx) => {
    if (ctx.message.text?.startsWith("/start") || ctx.message.text?.startsWith("/kirish")) return;
    await ctx.reply("Bu bot faqat xabar yuboradi — javob yozish shart emas.");
  });

  cached = bot;
  return bot;
}

/**
 * Telegram only accepts https:// (or tg://) URLs in an inline keyboard
 * button — it rejects http://localhost outright with "inline keyboard
 * button URL is invalid". NEXT_PUBLIC_APP_URL defaults to
 * http://localhost:3000 (lib/env.ts), so a deployment that never sets it
 * silently builds a link Telegram refuses; the reply throws, the webhook
 * returns 500, Telegram retries the same update, and each retry burns
 * another rate-limit hit until the user is locked out behind "Biroz
 * kuting" having never seen a button. Confirmed in production: 6
 * login_tokens rows created, 0 consumed, 3 LOGIN_OK events per 2 messages.
 *
 * BETTER_AUTH_URL is required (no default) and is the same origin, so it
 * is the trustworthy fallback when NEXT_PUBLIC_APP_URL is still local.
 */
function loginLinkBaseUrl(): string | null {
  for (const candidate of [env().NEXT_PUBLIC_APP_URL, env().BETTER_AUTH_URL]) {
    if (candidate?.startsWith("https://")) return candidate.replace(/\/$/, "");
  }
  return null;
}

async function sendLoginLink(ctx: Context): Promise<void> {
  const tgId = ctx.from?.id;
  if (!tgId || !ctx.chat) return;

  // Checked before the rate limit so a misconfigured deployment reports
  // itself on every attempt instead of consuming the user's budget.
  const baseUrl = loginLinkBaseUrl();
  if (!baseUrl) {
    console.error("login_link_base_url_invalid", {
      appUrl: env().NEXT_PUBLIC_APP_URL,
      authUrl: env().BETTER_AUTH_URL,
    });
    await logAuthEvent({ code: "CONFIG_ERROR", stage: "bot", ok: false, telegramId: tgId });
    await ctx.reply("Sayt manzili noto'g'ri sozlangan. Kod: NO_HTTPS_APP_URL");
    return;
  }

  if (!(await allow(`login:tg:${tgId}`, 3, 60))) {
    await ctx.reply("Biroz kuting va qayta urinib ko'ring.");
    return;
  }

  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");

  await authPool().query(
    `insert into login_tokens
       (token_hash, telegram_id, telegram_username, first_name, chat_id, expires_at)
     values ($1, $2, $3, $4, $5, now() + interval '10 minutes')`,
    [tokenHash, tgId, ctx.from?.username ?? null, ctx.from?.first_name ?? null, ctx.chat.id],
  );

  const url = `${baseUrl}/kirish/t?k=${raw}`;
  try {
    await ctx.reply(
      "Tizimga kirish uchun tugmani bosing.\n\nHavola 10 daqiqa amal qiladi va bir marta ishlatiladi.",
      { reply_markup: { inline_keyboard: [[{ text: "🔐 Saytga kirish", url }]] } },
    );
  } catch (err) {
    // Letting this escape 500s the webhook, which makes Telegram redeliver
    // the same update — and every redelivery costs another rate-limit hit.
    // Swallow it, log it, and fall back to a plain-text link.
    console.error("login_link_reply_failed", err);
    await logAuthEvent({ code: "CONFIG_ERROR", stage: "bot", ok: false, telegramId: tgId });
    await ctx.reply(`Tizimga kirish havolasi (10 daqiqa amal qiladi):\n${url}`);
    return;
  }

  await logAuthEvent({ code: "LOGIN_OK", stage: "bot", ok: true, telegramId: tgId });
}

async function handleParentLink(ctx: Context, code: string): Promise<void> {
  if (!ctx.chat) return;
  const chatId = ctx.chat.id;

  const db = adminDb();
  const { data: parent } = await db
    .from("parents")
    .select("id, org_id, full_name, linked_at, link_code_expires")
    .eq("link_code", code)
    .maybeSingle();

  if (
    !parent ||
    parent.linked_at ||
    (parent.link_code_expires && new Date(parent.link_code_expires) < new Date())
  ) {
    await ctx.reply("Havola noto'g'ri yoki muddati o'tgan. Bog'changizdan yangi havola so'rang.");
    return;
  }

  await db
    .from("parents")
    .update({ telegram_chat_id: chatId, linked_at: new Date().toISOString(), link_code: null })
    .eq("id", parent.id);

  const { data: children } = await db
    .from("parent_children")
    .select("children(full_name)")
    .eq("parent_id", parent.id);
  const names = (children ?? [])
    .map((c) => (c.children as unknown as { full_name: string } | null)?.full_name)
    .filter((n): n is string => !!n)
    .join(", ");

  await ctx.reply(
    names
      ? `Bog'landi! Endi ${names} haqida davomat xabarlarini shu yerda olasiz.`
      : "Bog'landi! Endi farzandingiz haqida davomat xabarlarini shu yerda olasiz.",
  );
}
