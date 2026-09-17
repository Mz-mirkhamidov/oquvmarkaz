import "server-only";
import { Bot } from "grammy";

import { env } from "@/lib/env";
import { adminDb } from "@/lib/db/admin";

let cached: Bot | undefined;

/**
 * One bot instance per server process. `webhookCallback()` (the webhook
 * route) and `sendMessage()` (the outbox processor) both use this — the
 * bot never runs its own long-polling loop, so there's nothing to start.
 */
export function getBot(): Bot {
  if (cached) return cached;

  const bot = new Bot(env().TELEGRAM_BOT_TOKEN);

  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim();
    const chatId = ctx.chat.id;

    if (!code) {
      await ctx.reply(
        "Assalomu alaykum! Farzandingiz davomati haqida xabar olish uchun bog'changiz sizga bergan havoladan foydalaning.",
      );
      return;
    }

    const db = adminDb();
    const { data: parent } = await db
      .from("parents")
      .select("id, org_id, full_name, linked_at, link_code_expires")
      .eq("link_code", code)
      .maybeSingle();

    if (!parent || parent.linked_at || (parent.link_code_expires && new Date(parent.link_code_expires) < new Date())) {
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
  });

  bot.on("message", async (ctx) => {
    if (ctx.message.text?.startsWith("/start")) return; // handled above
    await ctx.reply("Bu bot faqat xabar yuboradi — javob yozish shart emas.");
  });

  cached = bot;
  return bot;
}
