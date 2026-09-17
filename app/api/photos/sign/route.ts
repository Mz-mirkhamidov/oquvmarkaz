import type { NextRequest } from "next/server";

import { apiOk, apiErr } from "@/lib/api/response";
import { photoSignSchema } from "@/lib/schemas/photo";
import { requireAuth } from "@/lib/auth/guard";
import { requestDb } from "@/lib/db/server";
import { storage } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SIGN_TTL_SECONDS = 60;

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session.ok) return session.response;
  const orgId = session.auth.claims.org_id;

  const withinLimit = await checkRateLimit(`photos:org:${orgId}`, 300, 60);
  if (!withinLimit) return apiErr(429, "RATE_LIMITED", "Juda ko'p so'rov.");

  const json = await request.json().catch(() => null);
  const parsed = photoSignSchema.safeParse(json);
  if (!parsed.success) {
    return apiErr(400, "INVALID_PAYLOAD", "Ma'lumot noto'g'ri formatda.", parsed.error.flatten());
  }
  const { photo_id, record_id, child_id, day_date, mime } = parsed.data;

  const db = requestDb(session.auth.token);
  const { data: child } = await db
    .from("children")
    .select("id, photo_consent")
    .eq("id", child_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!child) return apiErr(403, "FORBIDDEN", "Bunday bola topilmadi.");
  if (!child.photo_consent) {
    return apiErr(403, "NO_CONSENT", "Bu bola uchun rasm olishga rozilik yo'q.");
  }

  const { data: record } = await db
    .from("attendance_records")
    .select("id")
    .eq("id", record_id)
    .eq("org_id", orgId)
    .eq("child_id", child_id)
    .maybeSingle();
  if (!record) return apiErr(404, "RECORD_NOT_FOUND", "Davomat yozuvi topilmadi.");

  const ext = mime === "image/webp" ? "webp" : "jpg";
  const [year, month, day] = day_date.split("-");
  const path = `${orgId}/${year}/${month}/${day}/${child_id}/${photo_id}.${ext}`;

  const target = await storage().createUploadUrl(path, { expiresIn: SIGN_TTL_SECONDS });

  return apiOk({
    upload_url: target.uploadUrl,
    path: target.path,
    token: target.token,
    expires_at: target.expiresAt,
  });
}
