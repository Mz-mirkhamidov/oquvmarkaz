"use client";

import { Check, Loader2, WifiOff, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import {
  useFailedCount,
  useOnlineStatus,
  useOutboxCount,
  usePendingPhotoCount,
} from "@/lib/offline/hooks";

export type SyncState = "saved" | "saving" | "offline" | "error";

/** TZ §8.7 — the four states and their exact copy; yellow is deliberately not styled as an error. */
export function SyncBar({ onRetry }: { onRetry?: () => void }) {
  const online = useOnlineStatus();
  const outboxCount = useOutboxCount();
  const photoCount = usePendingPhotoCount();
  const failedCount = useFailedCount();
  const pending = outboxCount + photoCount;

  if (failedCount > 0) {
    return (
      <Bar tone="danger" icon={AlertCircle}>
        <span className="flex-1">{failedCount} ta yozuv yuborilmadi</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="underline underline-offset-2">
            Qayta urinish
          </button>
        )}
      </Bar>
    );
  }

  if (!online) {
    return (
      <Bar tone="warn" icon={WifiOff}>
        {pending > 0
          ? `Internet yo'q — ${pending} ta yozuv navbatda`
          : "Internet yo'q — yozuvlaringiz saqlandi, internet kelganda avtomatik yuboriladi."}
      </Bar>
    );
  }

  if (pending > 0) {
    return (
      <Bar tone="info" icon={Loader2} spin>
        {pending} ta yozuv yuborilmoqda...
      </Bar>
    );
  }

  return (
    <Bar tone="ok" icon={Check}>
      Hammasi saqlandi
    </Bar>
  );
}

function Bar({
  tone,
  icon: Icon,
  spin,
  children,
}: {
  tone: "ok" | "info" | "warn" | "danger";
  icon: typeof Check;
  spin?: boolean;
  children: React.ReactNode;
}) {
  const toneClass = {
    ok: "bg-ok-soft text-ok",
    info: "bg-info-soft text-info",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  }[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium", toneClass)}
    >
      <Icon className={cn("size-4 shrink-0", spin && "animate-spin")} aria-hidden />
      {children}
    </div>
  );
}
