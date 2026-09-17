"use client";

import { useCallback, useState } from "react";
import { Delete } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export interface PinPadProps {
  length?: number;
  disabled?: boolean;
  onComplete: (pin: string) => void;
}

export function PinPad({ length = 4, disabled, onComplete }: PinPadProps) {
  const [value, setValue] = useState("");

  const press = useCallback(
    (key: string) => {
      if (disabled) return;
      if (key === "⌫") {
        setValue((v) => v.slice(0, -1));
        return;
      }
      if (key === "") return;
      setValue((v) => {
        const next = v.length < length ? v + key : v;
        if (next.length === length) {
          // let the dot animation land before handing off
          queueMicrotask(() => onComplete(next));
        }
        return next;
      });
    },
    [disabled, length, onComplete],
  );

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-3" role="status" aria-label={`${value.length}/${length} raqam kiritildi`}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 border-border-strong transition-colors duration-(--dur-fast)",
              i < value.length && "bg-brand border-brand",
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((digit, i) =>
          digit === "" ? (
            <span key={i} aria-hidden className="size-18" />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(digit)}
              aria-label={digit === "⌫" ? "O'chirish" : digit}
              className="flex size-18 items-center justify-center rounded-(--r-lg) border border-border bg-surface text-2xl font-medium text-text transition-colors duration-(--dur-fast) hover:bg-surface-2 active:bg-surface-2 disabled:opacity-50"
            >
              {digit === "⌫" ? <Delete className="size-6" aria-hidden /> : digit}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
