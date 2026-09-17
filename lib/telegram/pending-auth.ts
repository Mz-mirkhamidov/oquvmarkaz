"use client";

// initData is only valid for 5 minutes (TZ §7.3/§11.2 replay window), so
// holding it in sessionStorage between /kirish's "not registered yet" and
// the setup wizard's submit is fine — it's dead well before it could be
// replayed anywhere else, and never touches localStorage or a cookie.
const KEY = "qalqon:pending_telegram_init_data";

export function setPendingTelegramAuth(initData: string) {
  sessionStorage.setItem(KEY, initData);
}

export function takePendingTelegramAuth(): string | null {
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return value;
}
