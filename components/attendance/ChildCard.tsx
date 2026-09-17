"use client";

import { Check, X as XIcon, Thermometer, Palmtree } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { AttendStatus } from "@/lib/db/types";

export interface ChildCardData {
  id: string;
  full_name: string;
  record: { status: AttendStatus; marked_at: string } | null;
}

const STATUS_META: Record<
  AttendStatus,
  { label: string; icon: typeof Check; bg: string; fg: string }
> = {
  present: { label: "keldi", icon: Check, bg: "bg-present-bg", fg: "text-present" },
  absent: { label: "kelmadi", icon: XIcon, bg: "bg-absent-bg", fg: "text-absent" },
  sick: { label: "kasal", icon: Thermometer, bg: "bg-sick-bg", fg: "text-sick" },
  vacation: { label: "ta'tilda", icon: Palmtree, bg: "bg-sick-bg", fg: "text-sick" },
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function ChildCard({
  child,
  disabled,
  onTap,
}: {
  child: ChildCardData;
  disabled?: boolean;
  onTap: () => void;
}) {
  const meta = child.record ? STATUS_META[child.record.status] : null;
  const Icon = meta?.icon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (navigator.vibrate) navigator.vibrate(10);
        onTap();
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-(--r-lg) border border-border p-3 text-left transition-colors duration-(--dur)",
        meta ? meta.bg : "bg-surface",
        "min-h-16 disabled:opacity-60",
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-(--r-full) bg-surface-2 text-lg font-semibold text-text-2">
        {child.full_name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1">
        <span className="block text-[16px] font-medium text-text">{child.full_name}</span>
        <span className="block text-sm text-text-2">
          {child.record
            ? meta?.label === "keldi"
              ? `${timeLabel(child.record.marked_at)} · belgilandi`
              : meta?.label
            : "belgilanmagan"}
        </span>
      </span>
      {Icon && <Icon className={cn("size-6 shrink-0", meta?.fg)} aria-hidden />}
    </button>
  );
}
