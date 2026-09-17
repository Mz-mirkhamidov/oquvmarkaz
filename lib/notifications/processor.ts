import "server-only";

import { adminDb } from "@/lib/db/admin";
import { getBot } from "@/lib/telegram/bot";
import { renderNotification, type NotificationPayload } from "@/lib/notifications/templates";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * Drains up to one batch of `notification_outbox` (TZ §9's push channel).
 * Sequential, not parallel — Telegram rate-limits per chat, and a single
 * kindergarten's parent count never approaches a scale where that costs
 * anything noticeable. Called from /api/cron/notifications on a schedule.
 */
export async function processNotificationOutbox(): Promise<ProcessResult> {
  const db = adminDb();
  const bot = getBot();

  const { data: rows } = await db
    .from("notification_outbox")
    .select("id, parent_id, payload, attempts")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  const result: ProcessResult = { processed: 0, sent: 0, failed: 0 };
  if (!rows || rows.length === 0) return result;

  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter((id): id is string => !!id))];
  const { data: parents } = await db.from("parents").select("id, telegram_chat_id").in("id", parentIds);
  const chatIdByParent = new Map((parents ?? []).map((p) => [p.id, p.telegram_chat_id]));

  for (const row of rows) {
    result.processed++;
    const chatId = row.parent_id ? chatIdByParent.get(row.parent_id) : null;
    if (!chatId) {
      await db
        .from("notification_outbox")
        .update({ status: "cancelled", last_error: "no_chat_id" })
        .eq("id", row.id);
      continue;
    }

    try {
      const text = renderNotification(row.payload as unknown as NotificationPayload);
      await bot.api.sendMessage(chatId, text);
      await db.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq(
        "id",
        row.id,
      );
      result.sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      await db
        .from("notification_outbox")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: String(err),
        })
        .eq("id", row.id);
      result.failed++;
    }
  }

  return result;
}
