import { randomBytes } from "node:crypto";
import { sql } from "kysely";

import { apiOk, withApiErrorBoundary } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/guard";
import { withOrg } from "@/lib/db/with-org";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const BIND_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const BIND_CODE_TTL_HOURS = 24;

/** TZ v2 §4.3 — 8 belgili kod, "XXXX-XXXX" ko'rinishida. */
function generateBindCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += BIND_CODE_ALPHABET[b % BIND_CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export const GET = withApiErrorBoundary(async () => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const devices = await withOrg(
    { orgId: session.auth.claims.org_id, userId: session.auth.claims.sub, role: session.auth.claims.user_role },
    (tx) =>
      tx
        .selectFrom("devices")
        .select(["id", "label", "bound_at", "last_seen_at", "is_blocked", "created_at"])
        .orderBy("created_at", "desc")
        .execute(),
  );
  return apiOk(devices);
});

export const POST = withApiErrorBoundary(async (request: Request) => {
  const session = await requireManager();
  if (!session.ok) return session.response;

  const json = await request.json().catch(() => ({}) as { label?: string });
  const label = typeof json.label === "string" ? json.label.slice(0, 100) : null;

  const bindCode = generateBindCode();
  const bindExpires = new Date(Date.now() + BIND_CODE_TTL_HOURS * 60 * 60 * 1000);

  const device = await withOrg(
    { orgId: session.auth.claims.org_id, userId: session.auth.claims.sub, role: session.auth.claims.user_role },
    (tx) =>
      tx
        .insertInto("devices")
        .values({
          org_id: session.auth.claims.org_id,
          label,
          // secret_hash is not-null/unique; a device row exists from
          // creation, but "bound" only once /api/auth/device/bind
          // overwrites this placeholder with a real secret's hash.
          secret_hash: sql<string>`encode(gen_random_bytes(32), 'hex')`,
          bind_code: bindCode,
          bind_expires: bindExpires,
          created_by: session.auth.claims.sub,
        })
        .returning(["id", "bind_expires"])
        .executeTakeFirstOrThrow(),
  );

  await logAudit({
    orgId: session.auth.claims.org_id,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "device.create",
    entity: "devices",
    entityId: device.id,
    request,
  });

  return apiOk({ id: device.id, bind_code: bindCode, bind_expires: device.bind_expires });
});
