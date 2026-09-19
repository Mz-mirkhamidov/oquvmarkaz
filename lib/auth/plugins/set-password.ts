import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, getIP, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { allow } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/events";
import { authEndpointError } from "@/lib/auth/endpoint-response";

/**
 * Sets or changes the signed-in user's password.
 *
 * This is the recovery path, and it exists because there is no mail
 * provider: Better Auth's own /reset-password needs one to deliver the
 * token, so "parolni unutdim" cannot work by email here. The bot can
 * already prove who you are and hand you a session (telegram-login.ts),
 * so a manager who forgets their password signs in through Telegram and
 * sets a new one here — a complete recovery loop with nothing to send.
 *
 * Better Auth's built-ins each cover only half of this:
 *   - /change-password refuses an account that has no password yet
 *     (CREDENTIAL_ACCOUNT_NOT_FOUND), which is every Telegram account;
 *   - setPassword() handles that case but is serverOnly, so it is not
 *     reachable over HTTP, and it refuses once a password *is* set
 *     (PASSWORD_ALREADY_SET).
 * One endpoint covering both is what the UI actually needs.
 */
export const setPassword = () =>
  ({
    id: "set-password",
    endpoints: {
      setOwnPassword: createAuthEndpoint(
        "/password/set",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({
            new_password: z.string().min(1).max(256),
            // Only required when one is already set — see below.
            current_password: z.string().min(1).max(256).optional(),
          }),
        },
        async (ctx) => {
          const ip = getIP(ctx.headers ?? new Headers(), ctx.context.options) ?? null;
          const session = ctx.context.session;
          const userId = session.user.id;
          const orgId = (session.user as { orgId?: string | null }).orgId ?? undefined;

          if (!(await allow(`password:user:${userId}`, 10, 60))) {
            await logAuthEvent({
              code: "RATE_LIMITED",
              stage: "password",
              ok: false,
              userId,
              orgId,
              ip,
            });
            return ctx.json(authEndpointError("RATE_LIMITED"), { status: 429 });
          }

          const { new_password: newPassword, current_password: currentPassword } = ctx.body;
          const { minPasswordLength, maxPasswordLength } = ctx.context.password.config;
          if (newPassword.length < minPasswordLength || newPassword.length > maxPasswordLength) {
            return ctx.json(authEndpointError("PASSWORD_TOO_SHORT"), { status: 400 });
          }

          const account = await ctx.context.internalAdapter.findCredentialAccount(userId);
          // Named without the word "password" on purpose: A-T21
          // (tests/unit/auth-events-no-secrets.test.ts) rejects any
          // identifier matching /pin|token|secret|cookie|password|hash/
          // inside a logAuthEvent `detail` literal, and that blunt rule is
          // worth keeping exactly as blunt as it is.
          const wasChange = !!account?.password;
          const passwordHash = await ctx.context.password.hash(newPassword);

          if (wasChange && account) {
            // A password already exists, so the session alone is not
            // enough: someone who walked up to an unlocked tablet could
            // otherwise lock the real owner out of their own bog'cha.
            if (!currentPassword) {
              return ctx.json(authEndpointError("PASSWORD_WRONG"), { status: 400 });
            }
            const valid = await ctx.context.password.verify({
              hash: account.password as string,
              password: currentPassword,
            });
            if (!valid) {
              await logAuthEvent({
                code: "PASSWORD_WRONG",
                stage: "password",
                ok: false,
                userId,
                orgId,
                ip,
              });
              return ctx.json(authEndpointError("PASSWORD_WRONG"), { status: 400 });
            }
            await ctx.context.internalAdapter.updateAccount(account.id, {
              password: passwordHash,
            });
          } else if (account) {
            // A row exists with no password (e.g. linked by another
            // provider) — fill it in rather than creating a second one.
            await ctx.context.internalAdapter.updateAccount(account.id, {
              password: passwordHash,
            });
          } else {
            // First password for a Telegram-only account: the session is
            // the proof of identity here, exactly as Better Auth's own
            // setPassword() treats it.
            await ctx.context.internalAdapter.linkAccount({
              userId,
              providerId: "credential",
              accountId: userId,
              password: passwordHash,
            });
          }

          // Every other session dies. If this was a recovery ("someone
          // knows my password"), leaving those alive would defeat the
          // point; the current device gets a fresh session so the person
          // doing it is not signed out of the page they are on.
          await ctx.context.internalAdapter.deleteUserSessions(userId);
          const fresh = await ctx.context.internalAdapter.createSession(userId);
          if (!fresh) {
            return ctx.json(authEndpointError("DB_ERROR"), { status: 500 });
          }
          await setSessionCookie(ctx, { session: fresh, user: session.user });

          await logAuthEvent({
            code: "PASSWORD_SET",
            stage: "password",
            ok: true,
            userId,
            orgId,
            ip,
            detail: { changed: wasChange },
          });

          return ctx.json({ ok: true as const, data: { changed: wasChange } });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
