import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-(--r-lg) border border-dashed border-border px-6 py-14 text-center">
      <div className="text-text-3">{icon ?? <Inbox className="size-8" aria-hidden />}</div>
      <h3 className="text-[16px] font-semibold text-text">{title}</h3>
      <p className="max-w-sm text-sm text-text-2">{description}</p>
      {action}
    </div>
  );
}
