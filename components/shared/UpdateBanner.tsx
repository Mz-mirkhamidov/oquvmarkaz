"use client";

import { useServiceWorkerUpdate } from "@/lib/offline/register-sw";
import { Button } from "@/components/ui/button";

export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
  if (!updateAvailable) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 text-sm text-brand-text">
      <span>Yangi versiya tayyor</span>
      <Button size="sm" variant="secondary" onClick={applyUpdate}>
        Yangilash
      </Button>
    </div>
  );
}
