"use client";

import { Check, Loader2, WifiOff, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type SyncState = "saved" | "saving" | "offline" | "error";

const META: Record<SyncState, { icon: typeof Check; text: string; className: string }> = {
  saved: { icon: Check, text: "Hammasi saqlandi", className: "bg-ok-soft text-ok" },
  saving: { icon: Loader2, text: "Saqlanmoqda...", className: "bg-info-soft text-info" },
  offline: {
    icon: WifiOff,
    text: "Internet yo'q — yozuvlaringiz saqlandi, internet kelganda o'zi yuboriladi.",
    className: "bg-warn-soft text-warn",
  },
  error: { icon: AlertCircle, text: "Yuborilmadi", className: "bg-danger-soft text-danger" },
};

export function SyncBar({ state, onRetry }: { state: SyncState; onRetry?: () => void }) {
  const meta = META[state];
  const Icon = meta.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium",
        meta.className,
      )}
    >
      <Icon className={cn("size-4 shrink-0", state === "saving" && "animate-spin")} aria-hidden />
      <span className="flex-1">{meta.text}</span>
      {state === "error" && onRetry && (
        <button type="button" onClick={onRetry} className="underline underline-offset-2">
          Qayta urinish
        </button>
      )}
    </div>
  );
}
