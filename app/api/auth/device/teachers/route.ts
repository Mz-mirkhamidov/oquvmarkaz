import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { authPool } from "@/lib/db/auth-pool";
import { getBoundDevice } from "@/lib/auth/device-cookie";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

export const runtime = "nodejs";

/**
 * TZ v2 §4.3, §12.3 — backs the PIN screen's "Kim ishlayapti?" picker.
 * Device-cookie-gated (replaces the old public org-slug lookup): no
 * session yet, but the device must already be bound to an org.
 */
export const GET = withApiErrorBoundary(async () => {
  const device = await getBoundDevice();
  if (!device) return apiErr(401, "NO_DEVICE", AUTH_MESSAGES.NO_DEVICE);
  if (device.isBlocked) return apiErr(403, "DEVICE_BLOCKED", AUTH_MESSAGES.DEVICE_BLOCKED);

  const { rows } = await authPool().query<{ id: string; full_name: string | null }>(
    `select id, "fullName" as full_name
       from "user"
      where "orgId" = $1 and "appRole" = 'teacher' and "isActive" = true
      order by "fullName" asc`,
    [device.orgId],
  );
  return apiOk(rows);
});
