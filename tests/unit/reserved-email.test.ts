import { describe, expect, it } from "vitest";

import { isReservedSignUpEmail } from "@/lib/auth/plugins/telegram-login";

// Account-takeover guard. Telegram accounts have no real address, so they
// get a synthetic tg-<telegramId>@telegram.local one and are looked up by
// it. A Telegram ID is not secret, so with email sign-up open anyone could
// claim a person's synthetic address before that person ever logs in, and
// would then own the account the bot hands them. lib/auth/index.ts refuses
// sign-ups on that domain; these pin the rule itself.

describe("isReservedSignUpEmail", () => {
  it("blocks a Telegram account's synthetic address", () => {
    expect(isReservedSignUpEmail("tg-987654321@telegram.local")).toBe(true);
  });

  it("blocks it regardless of case or surrounding whitespace", () => {
    expect(isReservedSignUpEmail("  TG-1@TELEGRAM.LOCAL  ")).toBe(true);
    expect(isReservedSignUpEmail("tg-1@Telegram.Local")).toBe(true);
  });

  it("blocks any address on the domain, not just the tg- shape", () => {
    // The shape is an implementation detail of telegramEmail(); the domain
    // is what must never be claimable.
    expect(isReservedSignUpEmail("anything@telegram.local")).toBe(true);
  });

  it("allows ordinary addresses", () => {
    expect(isReservedSignUpEmail("rahbar@misol.uz")).toBe(false);
    expect(isReservedSignUpEmail("a@gmail.com")).toBe(false);
  });

  it("is not fooled by the domain appearing anywhere but the end", () => {
    expect(isReservedSignUpEmail("tg-1@telegram.local.evil.com")).toBe(false);
    expect(isReservedSignUpEmail("telegram.local@gmail.com")).toBe(false);
  });

  it("treats a missing or non-string value as not reserved", () => {
    // The guard reads ctx.body.email, which is unvalidated at that point.
    expect(isReservedSignUpEmail(undefined)).toBe(false);
    expect(isReservedSignUpEmail(null)).toBe(false);
    expect(isReservedSignUpEmail(42)).toBe(false);
  });
});
