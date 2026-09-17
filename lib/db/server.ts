import "server-only";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * RLS-respecting client for one request. `accessToken` is our own JWT
 * (signed with SUPABASE_JWT_SECRET, same shape PostgREST expects), sent
 * as the Authorization header so Postgres sees `request.jwt.claims` and
 * every policy in 0002_rls.sql applies exactly as it would for Supabase
 * Auth. We never use the service_role key here.
 */
export function requestDb(accessToken: string) {
  return createClient<Database>(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  );
}
