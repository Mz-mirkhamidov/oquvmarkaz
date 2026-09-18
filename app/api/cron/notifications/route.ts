import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { env } from "@/lib/env";
import { processNotificationOutbox } from "@/lib/notifications/processor";

export const runtime = "nodejs";

/**
 * Called on a schedule (Vercel Cron / GitHub Actions — see README) to
 * drain `notification_outbox`. No user session; the `Authorization:
 * Bearer <CRON_SECRET>` header is the only gate, same shape as Vercel's
 * own cron auth convention.
 */
export const POST = withApiErrorBoundary(async (request: Request) => {
  const secret = env().CRON_SECRET;
  if (!secret) return apiErr(500, "SERVER_ERROR", "CRON_SECRET sozlanmagan.");

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return apiErr(401, "UNAUTHORIZED", "Ruxsat yo'q.");
  }

  const result = await processNotificationOutbox();
  return apiOk(result);
});

export const GET = POST;
