"use client";

const DEVICE_KEY = "qalqon:device_key";

/**
 * Stable per-browser identifier used only by the offline sync outbox
 * (lib/offline/sync.ts) to label ops client-side — unrelated to the
 * server-verified device identity in lib/auth/device-cookie.ts (TZ v2
 * §4.3's bind code + httpOnly `qalqon_device` cookie).
 */
export function getOrCreateDeviceKey(): string {
  let key = localStorage.getItem(DEVICE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, key);
  }
  return key;
}
