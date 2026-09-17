// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashPin, verifyPin, nextLockout, isValidPinFormat, MAX_PIN_ATTEMPTS } from "@/lib/auth/pin";

describe("PIN format", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidPinFormat("0000")).toBe(true);
    expect(isValidPinFormat("9999")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("12345")).toBe(false);
    expect(isValidPinFormat("abcd")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
  });
});

describe("PIN hashing", () => {
  it("verifies a correct PIN and rejects a wrong one", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin(hash, "4821")).toBe(true);
    expect(await verifyPin(hash, "0000")).toBe(false);
  });
});

describe("nextLockout (T11 — 5 wrong attempts locks for 15 minutes)", () => {
  it("does not lock before the 5th failed attempt", () => {
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      expect(nextLockout(i)).toBeNull();
    }
  });

  it("locks for 15 minutes exactly on the 5th failed attempt", () => {
    const now = new Date("2026-09-17T08:00:00.000Z");
    const lockedUntil = nextLockout(MAX_PIN_ATTEMPTS, now);
    expect(lockedUntil).not.toBeNull();
    expect(lockedUntil!.getTime() - now.getTime()).toBe(15 * 60 * 1000);
  });

  it("stays locked for attempts beyond the 5th", () => {
    expect(nextLockout(MAX_PIN_ATTEMPTS + 3)).not.toBeNull();
  });
});
