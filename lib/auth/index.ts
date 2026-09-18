import "server-only";
import { betterAuth } from "better-auth";
import { customSession } from "better-auth/plugins";

import { env } from "@/lib/env";
import { authPool } from "@/lib/db/auth-pool";
import { adminDb } from "@/lib/db/admin";
import { telegramLogin } from "@/lib/auth/plugins/telegram-login";
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
 */
export const auth = betterAuth({
  database: authPool(),
  secret: env().BETTER_AUTH_SECRET,
  baseURL: env().BETTER_AUTH_URL,

  emailAndPassword: { enabled: false },
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
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 daqiqa — DB so'rovlarini kamaytiradi
    },
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

async function loadOrgSummary(orgId: string) {
  const { data } = await adminDb()
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  return data;
}
