import { headers } from "next/headers";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { getAuth } from "@/lib/auth";
import { authPool } from "@/lib/db/auth-pool";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

export const runtime = "nodejs";

/**
 * Whether this account has a password yet — the settings screen needs it
 * to decide between "Parol qo'yish" (a Telegram-only account, which has
 * no credential row at all) and "Parolni almashtirish" (ask for the
 * current one first). Deliberately returns nothing but the boolean: the
 * hash itself must never leave the server.
 */
export const GET = withApiErrorBoundary(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return apiErr(401, "NO_SESSION", AUTH_MESSAGES.NO_SESSION);

  const { rows } = await authPool().query<{ has_password: boolean }>(
    `select exists(
       select 1 from account
        where "userId" = $1 and "providerId" = 'credential' and password is not null
     ) as has_password`,
    [session.user.id],
  );

  return apiOk({ has_password: rows[0]?.has_password ?? false });
});
