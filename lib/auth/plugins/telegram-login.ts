import "server-only";
import { createHash } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, getIP } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { authPool } from "@/lib/db/auth-pool";
import { allow } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/events";
import { authEndpointError } from "@/lib/auth/endpoint-response";

/**
 * TZ v2 §7 — the one endpoint this plugin adds: consuming the one-time
 * login token the bot handed out (lib/telegram/bot.ts). No Mini App, no
 * HMAC (X2/X8) — Telegram's own webhook already proved the identity when
 * the token was minted.
 */
export const telegramLogin = () =>
  ({
    id: "telegram-login",
    endpoints: {
      consumeLoginToken: createAuthEndpoint(
        "/telegram/consume",
        { method: "POST", body: z.object({ k: z.string().min(20).max(200) }) },
        async (ctx) => {
          const ip = getIP(ctx.headers ?? new Headers(), ctx.context.options) ?? null;

          if (!(await allow(`token:ip:${ip ?? "unknown"}`, 10, 60))) {
            await logAuthEvent({ code: "RATE_LIMITED", stage: "token", ok: false, ip });
            return ctx.json(authEndpointError("RATE_LIMITED"), { status: 429 });
          }

          const hash = createHash("sha256").update(ctx.body.k).digest("hex");

          const { rows } = await authPool().query<{
            telegram_id: string;
            telegram_username: string | null;
            first_name: string | null;
            expired: boolean;
          }>(
            `update login_tokens
               set consumed_at = now(), consumed_ip = $2
             where token_hash = $1
               and consumed_at is null
             returning telegram_id, telegram_username, first_name,
                       (expires_at < now()) as expired`,
            [hash, ip],
          );

          const row = rows[0];
          if (!row) {
            await logAuthEvent({ code: "TOKEN_INVALID", stage: "token", ok: false, ip });
            return ctx.json(authEndpointError("TOKEN_INVALID"), { status: 401 });
          }
          if (row.expired) {
            await logAuthEvent({
              code: "TOKEN_EXPIRED",
              stage: "token",
              ok: false,
              telegramId: row.telegram_id,
              ip,
            });
            return ctx.json(authEndpointError("TOKEN_EXPIRED"), { status: 401 });
          }

          const found = await ctx.context.internalAdapter.findUserByEmail(
            telegramEmail(row.telegram_id),
          );
          let user = found?.user;

          if (!user) {
            user = await ctx.context.internalAdapter.createUser(
              {
                email: telegramEmail(row.telegram_id),
                emailVerified: true,
                name: row.first_name ?? "Foydalanuvchi",
                telegramId: row.telegram_id,
                telegramUsername: row.telegram_username,
                fullName: row.first_name ?? "Foydalanuvchi",
                appRole: "owner",
                orgId: null,
                isActive: true,
                failedPinCount: 0,
              } as never,
              { method: "telegram" },
            );
          }

          const typedUser = user as typeof user & {
            isActive: boolean | null;
            orgId: string | null;
          };
          if (typedUser.isActive === false) {
            await logAuthEvent({
              code: "USER_DISABLED",
              stage: "token",
              ok: false,
              userId: user.id,
              telegramId: row.telegram_id,
              ip,
            });
            return ctx.json(authEndpointError("USER_DISABLED"), { status: 403 });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });

          await logAuthEvent({
            code: "LOGIN_OK",
            stage: "token",
            ok: true,
            userId: user.id,
            telegramId: row.telegram_id,
            ip,
          });

          return ctx.json({ ok: true as const, needsSetup: !typedUser.orgId });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;

/**
 * Better Auth's core `user` schema requires a unique `email` (TZ v2 §5.1
 * keeps `emailAndPassword` disabled, but the column itself is still
 * `not null unique`). Telegram accounts get a synthetic, never-emailed
 * address instead of a second identity column to key off of.
 */
function telegramEmail(telegramId: string): string {
  return `tg-${telegramId}${TELEGRAM_EMAIL_DOMAIN}`;
}

/**
 * Exported so lib/auth/index.ts can refuse email sign-ups on it — a
 * Telegram ID is public, so anyone could otherwise claim a Telegram
 * user's synthetic address before they first log in. Keep the two in one
 * place: if this domain ever changes and the sign-up guard doesn't follow,
 * the hole reopens silently.
 */
export const TELEGRAM_EMAIL_DOMAIN = "@telegram.local";

/**
 * True for an address only the Telegram flow may ever own. Used by the
 * /sign-up/email guard in lib/auth/index.ts; extracted so the rule can be
 * tested without standing up a whole Better Auth instance.
 */
export function isReservedSignUpEmail(email: unknown): boolean {
  return String(email ?? "")
    .toLowerCase()
    .trim()
    .endsWith(TELEGRAM_EMAIL_DOMAIN);
}
