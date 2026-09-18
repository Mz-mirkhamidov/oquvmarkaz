import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { adminDb } from "@/lib/db/admin";

export const DEVICE_COOKIE = "qalqon_device";
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // TZ v2 §4.3 — 400 kun

/**
 * TZ v2 §4.3 — a shared classroom tablet's own long-lived identity,
 * separate from any user session: binding it once (via an 8-char code a
 * manager generates) lets `/kirish/pin` show that org's teacher list
 * without anyone being logged in yet.
 */
export async function setDeviceCookie(secret: string) {
  const store = await cookies();
  store.set(DEVICE_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}

export function hashDeviceSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateDeviceSecret(): string {
  return randomBytes(32).toString("base64url");
}

export interface BoundDevice {
  id: string;
  orgId: string;
  isBlocked: boolean;
}

/**
 * Reads the device cookie and resolves it to a `devices` row, with no
 * user session required — this is what lets a shared tablet show its
 * org's teacher picker pre-login. `devices` RLS (0012_app_role.sql) is
 * org-scoped, which a pre-auth caller by definition doesn't have yet, so
 * this — like the pre-existing org-slug teacher lookup it replaces — goes
 * through `adminDb()` (service_role) rather than the RLS-scoped app pool.
 */
export async function getBoundDevice(): Promise<BoundDevice | null> {
  const store = await cookies();
  const secret = store.get(DEVICE_COOKIE)?.value;
  if (!secret) return null;

  const hash = hashDeviceSecret(secret);
  const { data: row } = await adminDb()
    .from("devices")
    .select("id, org_id, is_blocked, secret_hash")
    .eq("secret_hash", hash)
    .maybeSingle();
  if (!row) return null;

  // Constant-time compare, defense in depth against a timing side
  // channel on the equality lookup above.
  const a = Buffer.from(hash);
  const b = Buffer.from(row.secret_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { id: row.id, orgId: row.org_id, isBlocked: row.is_blocked };
}

export async function touchDeviceLastSeen(deviceId: string) {
  await adminDb()
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId);
}
