import "server-only";

import { adminDb } from "@/lib/db/admin";
import type { Json, UserRole } from "@/lib/db/types";

/**
 * Writes to `audit_log` via service_role — RLS on that table grants
 * `authenticated` no INSERT policy at all (TZ §11.6), so every write goes
 * through here rather than the per-request RLS client.
 */
export async function logAudit(entry: {
  orgId: string | null;
  actorId: string | null;
  actorRole: UserRole | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Json;
  after?: Json;
  request?: Request;
}) {
  const { error } = await adminDb()
    .from("audit_log")
    .insert({
      org_id: entry.orgId,
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.request ? clientIp(entry.request) : null,
      user_agent: entry.request?.headers.get("user-agent") ?? null,
    });
  if (error) console.error("audit_log_error", error);
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}
