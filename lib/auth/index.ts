import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { customSession } from "better-auth/plugins";

import { env } from "@/lib/env";
import { authPool } from "@/lib/db/auth-pool";
import { adminDb } from "@/lib/db/admin";
import { telegramLogin, isReservedSignUpEmail } from "@/lib/auth/plugins/telegram-login";
import { devicePin } from "@/lib/auth/plugins/device-pin";

/**
 * TZ v2 §6 — the sole session/identity layer. Postgres (via `authPool`,
 * the `qalqon_auth` role) owns `user`/`session`/`account`/`verification`
 * plus our extra tables (login_tokens, devices, rate_limits, auth_events —
 * see supabase/migrations/0010-0012). `user` replaces `app_users`
 * entirely: `orgId`/`appRole`/`telegramId`/`pinHash`/... live on it as
 * `additionalFields`, all server-written (`input: false`).
 *
 * Plugins (telegramLogin, devicePin) are added in A2/A4 — see AUTH_SNAPSHOT
 * and TZ v2 §§7-8 for why Mini App `initData`/HMAC is gone (X1/X2/X8).
 *
 * Built lazily (getAuth(), not a module-scope `export const auth = ...`):
 * this module is imported transitively by nearly every route (via
 * lib/auth/guard.ts), and Next's `next build` page-data-collection step
 * imports every route module to inspect it — so a top-level `betterAuth({
 * database: authPool(), secret: env()... })` call used to run env()'s full
 * schema validation at *build* time, for every environment, whether or not
 * that particular route even touches auth. One missing env var then failed
 * the entire build, not just the routes that needed it — exactly
 * lib/env.ts's own "lazily validated... not called at module scope
 * anywhere" comment describes as the thing to avoid. Confirmed via a real
 * CI run (no env vars set at all, by design — it never needed any before
 * this rebuild): `next build` failed with "Invalid environment
 * configuration" listing every var in the schema, sourced from this file's
 * old eager construction.
 */
let cached: ReturnType<typeof buildAuth> | undefined;

export function getAuth() {
  if (!cached) cached = buildAuth();
  return cached;
}

function buildAuth() {
  return betterAuth({
    database: authPool(),
    secret: env().BETTER_AUTH_SECRET,
    baseURL: env().BETTER_AUTH_URL,

    // TZ v2 §5.1 kept this off when Telegram was the only way in. It is on
    // now because a bog'cha that cannot reach the bot (no Telegram, a bot
    // outage, a blocked account) otherwise has no way to register at all —
    // which is exactly what happened in production.
    //
    // requireEmailVerification stays false deliberately: there is no mail
    // provider wired up, so turning it on would lock every new account out
    // with no way to unlock it. It costs nothing here — an unverified
    // address grants no access to anything. A fresh account has orgId=null
    // and can only do one thing: create its OWN organization (POST
    // /api/org/setup, which refuses if orgId is already set). It can never
    // reach an existing bog'cha's data, and teachers are added by their
    // manager, not by signing up.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    socialProviders: {},

    user: {
      additionalFields: {
        telegramId: { type: "string", required: false, input: false },
        telegramUsername: { type: "string", required: false, input: false },
        fullName: { type: "string", required: false, input: false },
        appRole: { type: "string", required: false, input: false, defaultValue: "owner" },
        orgId: { type: "string", required: false, input: false },
        pinHash: { type: "string", required: false, input: false, returned: false },
        failedPinCount: {
          type: "number",
          required: false,
          input: false,
          defaultValue: 0,
          returned: false,
        },
        lockedUntil: { type: "date", required: false, input: false, returned: false },
        isActive: { type: "boolean", required: false, input: false, defaultValue: true },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 kun
      updateAge: 60 * 60 * 24, // kuniga bir marta yangilanadi
      additionalFields: {
        deviceId: { type: "string", required: false, input: false },
      },
      // Deliberately OFF. The cookie cache serves user/session fields
      // straight from a signed cookie without touching the DB, but in this
      // app those fields (orgId, appRole, isActive, deviceId) are exactly
      // what every permission decision reads — so a stale copy is both a
      // correctness and a security problem:
      //   - registration broke on it (confirmed in production): /sozlash
      //     step 1 writes "user".orgId, step 2 still read orgId=null from
      //     the cookie and failed with NO_ORG until the cache expired;
      //   - a teacher deactivated by a manager (isActive=false) would keep
      //     working for up to maxAge, as would a session whose device was
      //     just blocked (/api/devices/[id]/block).
      // The DB lookup it saves is a single indexed query.
      cookieCache: { enabled: false },
    },

    advanced: {
      cookiePrefix: "qalqon",
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax", // bot havolasidan qaytishda kerak
        path: "/",
      },
      database: {
        generateId: "uuid",
      },
    },

    rateLimit: { enabled: true, window: 60, max: 30 },

    databaseHooks: {
      user: {
        create: {
          // `fullName` is this app's own field and the only one the UI
          // reads (app/(app)/layout.tsx -> AppNav). Better Auth's
          // /sign-up/email writes core `name` and knows nothing about it,
          // so an email-registered manager showed up with a blank name in
          // the header. The Telegram plugin sets both already; this just
          // covers the paths that don't.
          before: async (user) => {
            const appUser = user as typeof user & { fullName?: string | null };
            if (appUser.fullName) return;
            return { data: { ...appUser, fullName: user.name } };
          },
        },
      },
    },

    hooks: {
      // Account-takeover guard, and the reason this is not just a config
      // flag. Telegram accounts have no real address, so the plugin gives
      // them a synthetic `tg-<telegramId>@telegram.local` (see
      // telegram-login.ts) and looks users up by it. Telegram IDs are not
      // secret. With email sign-up open, anyone could register
      // `tg-<victim's id>@telegram.local` with a password of their
      // choosing; the next time that person logged in through the bot,
      // findUserByEmail would hand them the attacker's account — and the
      // attacker would still hold the password to it, plus whatever
      // bog'cha that account went on to create. The domain is ours, never
      // routable, and no real person can receive mail at it, so refusing
      // it outright costs nobody anything.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        if (isReservedSignUpEmail((ctx.body as { email?: unknown } | undefined)?.email)) {
          throw new APIError("BAD_REQUEST", {
            code: "EMAIL_RESERVED",
            message: "Bu pochta manzilidan foydalanib bo'lmaydi.",
          });
        }
      }),
    },

    plugins: [
      telegramLogin(),
      devicePin(),
      customSession(async ({ user, session }) => {
        // customSession() can't see this config's own additionalFields (the
        // inferred type is circular: this array is *part of* the config that
        // produces it) — a cast is the standard Better Auth workaround.
        const appUser = user as typeof user & { orgId: string | null; appRole: string | null };
        return {
          user: appUser,
          session,
          org: appUser.orgId ? await loadOrgSummary(appUser.orgId) : null,
          role: appUser.appRole,
        };
      }),
    ],
  });
}

async function loadOrgSummary(orgId: string) {
  const { data } = await adminDb()
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  return data;
}
