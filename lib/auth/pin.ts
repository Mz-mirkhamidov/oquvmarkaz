import "server-only";
import * as argon2 from "argon2";

// TZ §11.2 — fixed argon2id parameters.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const PIN_PATTERN = /^\d{4}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, ARGON2_OPTIONS);
}

export async function verifyPin(hash: string, pin: string): Promise<boolean> {
  try {
    // argon2's own params (memoryCost/timeCost/type) travel inside the
    // encoded digest, so verify() takes none of ARGON2_OPTIONS.
    return await argon2.verify(hash, pin);
  } catch {
    return false;
  }
}

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

/**
 * TZ §11.2 / F-A5 — pure decision so it's unit-testable (T11) without a
 * database: given the failed-attempt count *after* this wrong PIN, returns
 * the `locked_until` timestamp to store, or null if not locked yet.
 */
export function nextLockout(failedCountAfterThisAttempt: number, now = new Date()): Date | null {
  if (failedCountAfterThisAttempt < MAX_PIN_ATTEMPTS) return null;
  return new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60 * 1000);
}
