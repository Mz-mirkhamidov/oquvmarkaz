import { ATTEND_STATUS_LABELS } from "@/lib/utils/labels";

export interface ArrivalPayload {
  kind: "arrival";
  child_name: string;
  day_date: string;
  marked_at: string; // ISO, server time
}

export interface AbsentPayload {
  kind: "absent";
  child_name: string;
  day_date: string;
  status: "absent" | "sick" | "vacation";
}

export interface SystemPayload {
  kind: "system";
  text: string;
}

export type NotificationPayload = ArrivalPayload | AbsentPayload | SystemPayload;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
}

/** Renders the Telegram message text for one notification_outbox row (TZ §9 message copy). */
export function renderNotification(payload: NotificationPayload): string {
  switch (payload.kind) {
    case "arrival":
      return `✅ ${payload.child_name} bog'chaga keldi (${formatTime(payload.marked_at)}).`;
    case "absent":
      return `ℹ️ ${payload.child_name} bugun ${(ATTEND_STATUS_LABELS[payload.status] ?? payload.status).toLowerCase()} deb belgilandi (${payload.day_date}).`;
    case "system":
      return payload.text;
  }
}
