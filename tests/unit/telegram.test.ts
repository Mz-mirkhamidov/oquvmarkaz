// @vitest-environment node
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

const BOT_TOKEN = "123456:TEST-TOKEN";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_JWT_SECRET = "jwt-secret";
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.TELEGRAM_BOT_USERNAME = "QalqonBot";
  process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
});

function buildInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("verifyTelegramInitData (T10)", () => {
  it("accepts a correctly signed, fresh initData", async () => {
    const { verifyTelegramInitData } = await import("@/lib/auth/telegram");
    const authDate = Math.floor(Date.now() / 1000).toString();
    const user = JSON.stringify({ id: 42, first_name: "Aziz" });
    const initData = buildInitData({ auth_date: authDate, user }, BOT_TOKEN);

    const result = verifyTelegramInitData(initData);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe(42);
  });

  it("rejects a hash signed with the wrong bot token", async () => {
    const { verifyTelegramInitData } = await import("@/lib/auth/telegram");
    const authDate = Math.floor(Date.now() / 1000).toString();
    const user = JSON.stringify({ id: 42, first_name: "Aziz" });
    const initData = buildInitData({ auth_date: authDate, user }, "wrong:token");

    const result = verifyTelegramInitData(initData);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_hash");
  });

  it("rejects a hand-tampered field even with an otherwise valid hash", async () => {
    const { verifyTelegramInitData } = await import("@/lib/auth/telegram");
    const authDate = Math.floor(Date.now() / 1000).toString();
    const user = JSON.stringify({ id: 42, first_name: "Aziz" });
    const initData = buildInitData({ auth_date: authDate, user }, BOT_TOKEN);
    const tampered = initData.replace("Aziz", "Bekzod");

    const result = verifyTelegramInitData(tampered);

    expect(result.ok).toBe(false);
  });

  it("rejects auth_date older than 5 minutes (replay protection)", async () => {
    const { verifyTelegramInitData } = await import("@/lib/auth/telegram");
    const oldAuthDate = (Math.floor(Date.now() / 1000) - 600).toString();
    const user = JSON.stringify({ id: 42, first_name: "Aziz" });
    const initData = buildInitData({ auth_date: oldAuthDate, user }, BOT_TOKEN);

    const result = verifyTelegramInitData(initData);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });
});
