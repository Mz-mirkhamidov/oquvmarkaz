import "server-only";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * service_role client — bypasses RLS entirely. Use only where there is no
 * user JWT yet (auth exchange) or for jobs that legitimately span orgs
 * (cron). Every query built on top of this MUST filter by org_id by hand
 * (TZ §11.3 — RLS plus a manual filter is the two-layer defense).
 */
export function adminDb() {
  return createClient<Database>(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
