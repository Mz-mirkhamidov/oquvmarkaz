import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import { apiOk, apiErr, withApiErrorBoundary } from "@/lib/api/response";
import { photoAttachSchema } from "@/lib/schemas/photo";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = withApiErrorBoundary(async (request: NextRequest) => {
  const session = await requireAuth();
  if (!session.ok) return session.response;
  const orgId = session.auth.claims.org_id;

  const json = await request.json().catch(() => null);
  const parsed = photoAttachSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }
  const { photo_id, record_id, path, sha256, bytes, width, height, taken_at } = parsed.data;

  // Path must live under this org's own prefix — never trust the client's word alone.
  if (!path.startsWith(`${orgId}/`)) {
    return apiErr(403, "FORBIDDEN", "Noto'g'ri fayl yo'li.");
  }

  const db = requestDb(session.auth.token);
  const { data: record } = await db
    .from("attendance_records")
    .select("id, child_id")
    .eq("id", record_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!record) return apiErr(404, "RECORD_NOT_FOUND", "Davomat yozuvi topilmadi.");

  // Re-hash the uploaded bytes server-side — TZ §7.7: without this, the
  // hash in the evidence chain proves nothing (anyone could upload a
  // different file and claim whatever hash they like).
  let actualBytes: Uint8Array;
  try {
    actualBytes = await storage().read(path);
  } catch {
    return apiErr(404, "UPLOAD_NOT_FOUND", "Fayl topilmadi. Avval yuklang.");
  }

  const actualHash = createHash("sha256").update(actualBytes).digest("hex");
  if (actualHash !== sha256 || actualBytes.byteLength !== bytes) {
    await storage()
      .remove([path])
      .catch(() => {});
    return apiErr(409, "HASH_MISMATCH", "Fayl imzosi mos kelmadi.");
  }

  const { data: photo, error } = await db
    .from("attendance_photos")
    .insert({
      id: photo_id,
      org_id: orgId,
      record_id,
      child_id: record.child_id,
      storage_path: path,
      sha256: actualHash,
      bytes: actualBytes.byteLength,
      width: width ?? null,
      height: height ?? null,
      taken_at,
    })
    .select("id, record_id, sha256")
    .single();

  if (error || !photo) {
    if (error?.code === "23505") {
      return apiErr(409, "ALREADY_ATTACHED", "Bu yozuvga rasm allaqachon biriktirilgan.");
    }
    return apiErr(500, "DB_ERROR", "Rasmni saqlab bo'lmadi.");
  }

  await logAudit({
    orgId,
    actorId: session.auth.claims.sub,
    actorRole: session.auth.claims.user_role,
    action: "photo.attach",
    entity: "attendance_photos",
    entityId: photo.id,
    after: { record_id, sha256: actualHash },
    request,
  });

  return apiOk(photo);
});
