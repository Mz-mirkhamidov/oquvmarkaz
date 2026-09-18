import { z } from "zod";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { adminDb } from "@/lib/db/admin";
import { allow } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/events";
import { setDeviceCookie, hashDeviceSecret, generateDeviceSecret } from "@/lib/auth/device-cookie";
import { clientIp } from "@/lib/audit";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

export const runtime = "nodejs";

const bindSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((s) => s.replace(/[^A-Z0-9]/g, ""))
    .refine((s) => s.length === 8, "Kod 8 belgidan iborat bo'lishi kerak"),
});

/** TZ v2 §4.3 — binds a shared tablet to an org, once, via a manager-issued code. */
export const POST = withApiErrorBoundary(async (request: Request) => {
  const ip = clientIp(request) ?? "unknown";
  if (!(await allow(`bind:ip:${ip}`, 5, 60 * 60))) {
    return apiErr(429, "RATE_LIMITED", AUTH_MESSAGES.RATE_LIMITED);
  }

  const json = await request.json().catch(() => null);
  const parsed = bindSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }

  const normalized = parsed.data.code;
  const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
  const secret = generateDeviceSecret();
  const secretHash = hashDeviceSecret(secret);

  const { data: device, error } = await adminDb()
    .from("devices")
    .update({ secret_hash: secretHash, bound_at: new Date().toISOString(), bind_code: null })
    .eq("bind_code", formatted)
    .gt("bind_expires", new Date().toISOString())
    .is("bound_at", null)
    .select("id, org_id")
    .maybeSingle();

  if (error || !device) {
    await logAuthEvent({ code: "BIND_CODE_INVALID", stage: "device", ok: false, ip });
    return apiErr(400, "BIND_CODE_INVALID", AUTH_MESSAGES.BIND_CODE_INVALID);
  }

  await setDeviceCookie(secret);
  await logAuthEvent({
    code: "LOGIN_OK",
    stage: "device",
    ok: true,
    orgId: device.org_id,
    deviceId: device.id,
    ip,
  });

  return apiOk({ bound: true });
});
