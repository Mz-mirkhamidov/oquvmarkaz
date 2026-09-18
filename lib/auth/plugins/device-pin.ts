import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, getIP } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { authPool } from "@/lib/db/auth-pool";
import { adminDb } from "@/lib/db/admin";
import { allow } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/events";
import { verifyPin, nextLockout, MAX_PIN_ATTEMPTS } from "@/lib/auth/pin-hash";
import { authEndpointError } from "@/lib/auth/endpoint-response";

/**
 * TZ v2 §4.3, §7 — tarbiyachi PIN sign-in against the new `"user"` table
 * (appRole='teacher'). Per-user lockout (failedPinCount/lockedUntil) is
 * implemented; the device bind-code + cookie half of §4.3 (devices table,
 * DEVICE_BLOCKED) is a tracked follow-up, not wired in yet — see
 * app/(auth)/kirish/pin/page.tsx.
 */
export const devicePin = () =>
  ({
    id: "device-pin",
    endpoints: {
      pinSignIn: createAuthEndpoint(
        "/pin/sign-in",
        {
          method: "POST",
          body: z.object({
            org_slug: z.string().min(1),
            user_id: z.string().min(1),
            pin: z.string().regex(/^\d{4}$/),
          }),
        },
        async (ctx) => {
          const ip = getIP(ctx.headers ?? new Headers(), ctx.context.options) ?? null;

          if (!(await allow(`pin:ip:${ip ?? "unknown"}`, 10, 60))) {
            await logAuthEvent({ code: "RATE_LIMITED", stage: "pin", ok: false, ip });
            return ctx.json(authEndpointError("RATE_LIMITED"), { status: 429 });
          }

          const { data: org } = await adminDb()
            .from("organizations")
            .select("id")
            .eq("slug", ctx.body.org_slug)
            .maybeSingle();
          if (!org) {
            return ctx.json(authEndpointError("PIN_WRONG"), { status: 401 });
          }

          const pool = authPool();
          const { rows } = await pool.query<{
            id: string;
            pinHash: string | null;
            failedPinCount: number;
            lockedUntil: string | null;
            isActive: boolean;
          }>(
            `select id, "pinHash", "failedPinCount", "lockedUntil", "isActive"
               from "user"
              where id = $1 and "orgId" = $2 and "appRole" = 'teacher'`,
            [ctx.body.user_id, org.id],
          );
          const teacher = rows[0];
          if (!teacher || !teacher.pinHash) {
            return ctx.json(authEndpointError("PIN_WRONG"), { status: 401 });
          }
          if (!teacher.isActive) {
            await logAuthEvent({
              code: "USER_DISABLED",
              stage: "pin",
              ok: false,
              userId: teacher.id,
              ip,
            });
            return ctx.json(authEndpointError("USER_DISABLED"), { status: 403 });
          }
          if (teacher.lockedUntil && new Date(teacher.lockedUntil) > new Date()) {
            await logAuthEvent({ code: "PIN_LOCKED", stage: "pin", ok: false, userId: teacher.id, ip });
            return ctx.json(authEndpointError("PIN_LOCKED"), { status: 423 });
          }

          const valid = await verifyPin(ctx.body.pin, teacher.pinHash);
          if (!valid) {
            const failedCount = teacher.failedPinCount + 1;
            const lockedUntil = nextLockout(failedCount);
            await pool.query(
              `update "user" set "failedPinCount" = $1, "lockedUntil" = $2 where id = $3`,
              [failedCount, lockedUntil, teacher.id],
            );
            await logAuthEvent({
              code: lockedUntil ? "PIN_LOCKED" : "PIN_WRONG",
              stage: "pin",
              ok: false,
              userId: teacher.id,
              ip,
              detail: { attempts: failedCount, max: MAX_PIN_ATTEMPTS },
            });
            return ctx.json(authEndpointError(lockedUntil ? "PIN_LOCKED" : "PIN_WRONG"), {
              status: lockedUntil ? 423 : 401,
            });
          }

          await pool.query(`update "user" set "failedPinCount" = 0, "lockedUntil" = null where id = $1`, [
            teacher.id,
          ]);

          const user = await ctx.context.internalAdapter.findUserById(teacher.id);
          if (!user) {
            return ctx.json(authEndpointError("DB_ERROR"), { status: 500 });
          }
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });

          await logAuthEvent({ code: "LOGIN_OK", stage: "pin", ok: true, userId: user.id, ip });
          return ctx.json({ ok: true as const, data: {} });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
