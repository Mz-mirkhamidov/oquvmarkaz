"use client";

import { db, type OutboxOp } from "@/lib/offline/db";
import { getOrCreateDeviceKey } from "@/lib/device";
import { apiPost, ApiClientError } from "@/lib/api/client";
import { compressPhoto } from "@/lib/media/compress";
import { MAX_SYNC_ATTEMPTS } from "@/lib/offline/constants";

// TZ §8.4 — backoff ladder for network failures; op-level 'rejected'
// results are a different thing (a business decision, not a retry case)
// and get removed from the outbox immediately either way.
const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000, 60000];
const BATCH_SIZE = 200;

let syncing = false;
let backoffUntil = 0;

interface SyncOpResult {
  op_id: string;
  status: "applied" | "duplicate" | "rejected";
  reason?: string;
  record_id?: string;
}

export async function syncNow(): Promise<void> {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (Date.now() < backoffUntil) return;

  syncing = true;
  try {
    await pushOutbox();
    await pushPhotos();
  } finally {
    syncing = false;
  }
}

async function pushOutbox(): Promise<void> {
  const ops = await db.outbox.orderBy("created_at").limit(BATCH_SIZE).toArray();
  if (ops.length === 0) return;

  let response: { results: SyncOpResult[] };
  try {
    response = await apiPost("/api/sync/push", {
      device_key: getOrCreateDeviceKey(),
      ops: ops.map((op) => ({
        op_id: op.op_id,
        type: op.type,
        client_at: op.client_at,
        payload: op.payload,
      })),
    });
  } catch (err) {
    await handleNetworkFailure(ops, err);
    return;
  }

  const byOpId = new Map(response.results.map((r) => [r.op_id, r]));
  for (const op of ops) {
    const result = byOpId.get(op.op_id);
    if (!result) continue;

    if (result.status === "applied" || result.status === "duplicate") {
      await db.outbox.delete(op.op_id);
      const recordId = (op.payload as { record_id?: string }).record_id;
      if (recordId) await db.records.update(recordId, { synced: true });
    } else if (result.status === "rejected") {
      await db.outbox.delete(op.op_id);
      const recordId = (op.payload as { record_id?: string }).record_id;
      if (recordId) {
        await db.records.update(recordId, { rejected_reason: result.reason ?? "unknown" });
      }
    }
  }

  // More queued than one batch covers — keep going once this page is applied.
  if (ops.length === BATCH_SIZE) void syncNow();
}

async function handleNetworkFailure(ops: OutboxOp[], err: unknown): Promise<void> {
  // Covers both a real network failure and a transport-level error
  // response (401/429/500 — ApiClientError) — either way the batch
  // wasn't processed, so every op in it needs the same backoff+retry
  // treatment, not just op-count-based failures. A 401 in particular
  // means the session expired; the op stays queued and gets retried
  // once the user's re-authenticated (a fresh cookie makes the same
  // request succeed), so nothing here is lost, just delayed.
  for (const op of ops) {
    const attempts = op.attempts + 1;
    if (attempts > MAX_SYNC_ATTEMPTS) {
      await db.outbox.update(op.op_id, { attempts, last_error: "failed" });
    } else {
      await db.outbox.update(op.op_id, { attempts, last_error: String(err) });
    }
  }
  const delayIndex = Math.min(ops[0]?.attempts ?? 0, BACKOFF_MS.length - 1);
  backoffUntil = Date.now() + BACKOFF_MS[delayIndex];
}

async function pushPhotos(): Promise<void> {
  // One at a time, deliberately — TZ §8.4: don't clog a mobile connection
  // with parallel uploads while attendance ops still need bandwidth.
  const photo = await db.photos.where("status").equals("queued").first();
  if (!photo) return;

  await db.photos.update(photo.photo_id, { status: "uploading" });
  try {
    const compressed = await compressPhoto(photo.blob);

    const sign = await apiPost<{ upload_url: string; path: string }>("/api/photos/sign", {
      photo_id: photo.photo_id,
      record_id: photo.record_id,
      child_id: photo.child_id,
      day_date: photo.day_date,
      sha256: photo.sha256,
      bytes: compressed.size,
      mime: "image/webp",
    });

    const uploadRes = await fetch(sign.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
      body: compressed,
    });
    if (!uploadRes.ok) throw new Error("upload_failed");

    await apiPost("/api/photos/attach", {
      photo_id: photo.photo_id,
      record_id: photo.record_id,
      path: sign.path,
      sha256: photo.sha256,
      bytes: compressed.size,
      taken_at: photo.taken_at,
    });

    await db.photos.update(photo.photo_id, { status: "done" });
    await db.records.update(photo.record_id, { has_photo: true });
    void pushPhotos(); // next one, if any
  } catch (err) {
    const attempts = photo.attempts + 1;
    // HASH_MISMATCH is permanent — the same blob will always hash the
    // same way, so retrying just burns bandwidth for nothing.
    const permanent = err instanceof ApiClientError && err.code === "HASH_MISMATCH";
    await db.photos.update(photo.photo_id, {
      status: permanent || attempts > MAX_SYNC_ATTEMPTS ? "failed" : "queued",
      attempts,
    });
    if (!permanent) {
      backoffUntil = Date.now() + BACKOFF_MS[Math.min(photo.attempts, BACKOFF_MS.length - 1)];
    }
  }
}

export function setupAutoSync(): () => void {
  const interval = setInterval(() => void syncNow(), 30_000);
  const onOnline = () => void syncNow();
  window.addEventListener("online", onOnline);
  void syncNow();
  return () => {
    clearInterval(interval);
    window.removeEventListener("online", onOnline);
  };
}
