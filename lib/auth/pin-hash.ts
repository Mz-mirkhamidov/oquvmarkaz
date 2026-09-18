import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

// TZ v2 §3.5 — no native module (argon2/bcrypt): node:crypto's built-in
// scrypt. A 4-digit PIN's real defense is attempt-limiting (lib/auth/rate-
// limit.ts, MAX_PIN_ATTEMPTS below), not the hash's cost parameters.
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

const PIN_PATTERN = /^\d{4}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [alg, nStr, rStr, pStr, saltB64, keyB64] = parts;
  if (alg !== "scrypt") return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  try {
    const key = await scryptAsync(pin, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

/**
 * TZ v2 §10 — pure decision so it's unit-testable without a database: given
 * the failed-attempt count *after* this wrong PIN, returns the
 * `locked_until` timestamp to store, or null if not locked yet.
 */
export function nextLockout(failedCountAfterThisAttempt: number, now = new Date()): Date | null {
  if (failedCountAfterThisAttempt < MAX_PIN_ATTEMPTS) return null;
  return new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60 * 1000);
}
