"use client";

// Minimal typing for the bits of the Telegram Mini App SDK we use.
// TZ §7.3's verification algorithm (HMAC keyed by "WebAppData") is the
// Mini App `initData` scheme, not the website Login Widget's — so the
// login page only produces a valid signature when it is actually opened
// as a Telegram Mini App (from a bot button), not as a plain browser tab.
// See app/(auth)/kirish/page.tsx for how that's surfaced to the user.
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string } };
  ready: () => void;
  expand: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SDK_SRC = "https://telegram.org/js/telegram-web-app.js";

let loadPromise: Promise<TelegramWebApp | null> | null = null;

/** Loads the Telegram WebApp SDK and resolves it, or null outside Telegram / on failure. */
export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loadPromise;
}
