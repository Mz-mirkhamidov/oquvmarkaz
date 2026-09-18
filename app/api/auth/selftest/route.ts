import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authPool } from "@/lib/db/auth-pool";
import { appDb } from "@/lib/db/app-pool";
import { getMe, getWebhookInfo } from "@/lib/telegram/api";

export const runtime = "nodejs";

/**
 * TZ v2 §11.2 (X6 fix) — the whole auth chain, in one page, behind a
 * secret so it's safe to open from a plain browser. Never returns actual
 * secret values, only presence/length/a hash fingerprint.
 */
export const GET = async (request: NextRequest) => {
  const key = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-selftest-key");
  if (!key || key !== process.env.SELFTEST_KEY) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const problems: string[] = [];

  const env = {
    BETTER_AUTH_SECRET: describe(process.env.BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: describeValue(process.env.BETTER_AUTH_URL),
    AUTH_DATABASE_URL: describeDbUrl(process.env.AUTH_DATABASE_URL),
    DATABASE_URL: describeDbUrl(process.env.DATABASE_URL),
    TELEGRAM_BOT_TOKEN: describeFingerprint(process.env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_WEBHOOK_SECRET: describe(process.env.TELEGRAM_WEBHOOK_SECRET),
    NEXT_PUBLIC_APP_URL: describeValue(process.env.NEXT_PUBLIC_APP_URL),
  };
  for (const [name, info] of Object.entries(env)) {
    if (!info.present) problems.push(`ENV_MISSING:${name}`);
  }

  const db = {
    auth_pool: await checkPool(async () => {
      const { rows } = await authPool().query<{ table_name: string }>(
        `select table_name from information_schema.tables
           where table_schema = 'public' and table_name in ('user','session','account','verification')`,
      );
      return { tables: rows.map((r) => r.table_name) };
    }),
    app_pool: await checkPool(async () => {
      const rows = await appDb()
        .selectFrom("devices")
        .select(({ fn }) => [fn.count<number>("id").as("n")])
        .execute();
      return { role: "qalqon_app", count: rows[0]?.n ?? 0 };
    }),
  };
  if (!db.auth_pool.ok) problems.push("AUTH_DATABASE_URL_UNREACHABLE");
  if (!db.app_pool.ok) problems.push("DATABASE_URL_UNREACHABLE");

  const [meResult, webhookResult] = await Promise.all([getMe(), getWebhookInfo()]);
  const expectedWebhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`
    : undefined;
  const webhookOk =
    webhookResult.ok &&
    !webhookResult.result?.last_error_message &&
    (!expectedWebhookUrl || webhookResult.result?.url === expectedWebhookUrl);

  const telegram = {
    getMe: meResult.ok
      ? { ok: true, username: meResult.result?.username, id: meResult.result?.id }
      : { ok: false, description: meResult.description },
    getWebhookInfo: {
      ok: webhookOk,
      url: webhookResult.result?.url,
      expected: expectedWebhookUrl,
      pending_update_count: webhookResult.result?.pending_update_count,
      last_error_message: webhookResult.result?.last_error_message,
      problem: webhookOk ? undefined : "WEBHOOK_URL_MISMATCH",
    },
  };
  if (!meResult.ok) problems.push("TELEGRAM_BOT_TOKEN_INVALID");
  if (!webhookOk) problems.push("WEBHOOK_URL_MISMATCH");

  return NextResponse.json({
    ok: problems.length === 0,
    checked_at: new Date().toISOString(),
    env,
    db,
    telegram,
    problems,
  });
};

function describe(value: string | undefined) {
  return { present: !!value, len: value?.length ?? 0 };
}

function describeValue(value: string | undefined) {
  return { present: !!value, value: value ?? null };
}

function describeFingerprint(value: string | undefined) {
  if (!value) return { present: false, fingerprint: null };
  const hash = createHash("sha256").update(value).digest("hex");
  return { present: true, fingerprint: `…${hash.slice(-6)}` };
}

function describeDbUrl(value: string | undefined) {
  if (!value) return { present: false };
  try {
    const url = new URL(value);
    return { present: true, host: url.hostname, port: url.port, user: url.username };
  } catch {
    return { present: true, host: "invalid_url" };
  }
}

async function checkPool<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latency_ms?: number } & Partial<T>> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ok: true, latency_ms: Date.now() - start, ...result };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message } as never;
  }
}
