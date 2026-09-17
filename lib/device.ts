"use client";

const DEVICE_KEY = "qalqon:device_key";
const ORG_SLUG_KEY = "qalqon:org_slug";

/** Stable per-browser device identifier (TZ §8.6 devices.device_key) — survives reloads, not tab-scoped. */
export function getOrCreateDeviceKey(): string {
  let key = localStorage.getItem(DEVICE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, key);
  }
  return key;
}

/** The org a shared classroom tablet is bound to, set once via /kirish/pin/[slug]. */
export function getBoundOrgSlug(): string | null {
  return localStorage.getItem(ORG_SLUG_KEY);
}

export function setBoundOrgSlug(slug: string) {
  localStorage.setItem(ORG_SLUG_KEY, slug);
}
