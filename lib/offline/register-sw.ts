"use client";

import { useEffect, useState } from "react";

/**
 * Registers /sw.js and exposes whether an updated version is waiting.
 * TZ §8.6: never force a reload mid-session — the caller shows a button
 * and only applies the update when the teacher chooses to.
 */
export function useServiceWorkerUpdate(): { updateAvailable: boolean; applyUpdate: () => void } {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (reg.waiting) setWaitingWorker(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(reg.waiting ?? installing);
            }
          });
        });
      })
      .catch(() => {
        // PWA install/offline caching just won't be available — the
        // Dexie-backed offline queue (lib/offline/) still works fine.
      });

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function applyUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  return { updateAvailable: !!waitingWorker, applyUpdate };
}
