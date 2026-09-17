"use client";

import { Check, X as XIcon, Thermometer, Palmtree } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import type { AttendStatus } from "@/lib/db/types";

const OPTIONS: { status: AttendStatus; label: string; icon: typeof Check }[] = [
  { status: "present", label: "Keldi", icon: Check },
  { status: "absent", label: "Kelmadi", icon: XIcon },
  { status: "sick", label: "Kasal", icon: Thermometer },
  { status: "vacation", label: "Ta'tilda", icon: Palmtree },
];

export function StatusSheet({
  open,
  onOpenChange,
  childName,
  currentStatus,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childName: string;
  currentStatus?: AttendStatus;
  onSelect: (status: AttendStatus) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{childName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {OPTIONS.map(({ status, label, icon: Icon }) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                onSelect(status);
                onOpenChange(false);
              }}
              className={cn(
                "flex h-14 items-center gap-3 rounded-(--r-md) border border-border px-4 text-[16px] font-medium text-text hover:bg-surface-2",
                currentStatus === status && "border-brand bg-brand-soft",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
