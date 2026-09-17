import "server-only";

import { adminDb } from "@/lib/db/admin";
import type { NotificationPayload } from "@/lib/notifications/templates";
import type { Json } from "@/lib/db/types";

/**
 * Fan-out for one child's status change: every linked, notification-
 * enabled parent of that child gets one `notification_outbox` row. Uses
 * service_role like `logAudit` — `notification_outbox` has no INSERT
 * policy for `authenticated` at all (0002_rls.sql), so a teacher's or
 * director's per-request client could never write here directly.
 */
export async function enqueueAttendanceNotification(
  orgId: string,
  childId: string,
  payload: NotificationPayload,
): Promise<void> {
  const db = adminDb();

  const { data: links } = await db.from("parent_children").select("parent_id").eq("child_id", childId);
  const parentIds = (links ?? []).map((l) => l.parent_id);
  if (parentIds.length === 0) return;

  const { data: parents } = await db
    .from("parents")
    .select("id")
    .eq("org_id", orgId)
    .eq("notify_enabled", true)
    .not("telegram_chat_id", "is", null)
    .in("id", parentIds);
  if (!parents || parents.length === 0) return;

  const { error } = await db.from("notification_outbox").insert(
    parents.map((p) => ({
      org_id: orgId,
      parent_id: p.id,
      child_id: childId,
      kind: payload.kind,
      payload: payload as unknown as Json,
    })),
  );
  if (error) console.error("notification_enqueue_error", error);
}
