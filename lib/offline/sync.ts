"use client";

import { db, type OutboxOp, type PendingPhoto } from "@/lib/offline/db";
import { getOrCreateDeviceKey } from "@/lib/device";
import { apiPost, ApiClientError } from "@/lib/api/client";
import { compressPhoto } from "@/lib/media/compress";
import { sha256Hex } from "@/lib/crypto/sha256";
import { MAX_SYNC_ATTEMPTS } from "@/lib/offline/constants";

// TZ §8.4 — backoff ladder for network failures; op-level 'rejected'
// results are a different thing (a business decision, not a retry case)
// and get removed from the outbox immediately either way.
const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000, 60000];
const BATCH_SIZE = 200;

let syncing = false;
let rerunRequested = false;
// Two separate clocks on purpose. They used to be one, which meant a photo
// that kept failing to upload also stopped attendance ops from being
// pushed — the photo is a nice-to-have, the attendance record is the
// thing the bog'cha is legally accountable for, so it must never be held
// hostage by a stalled image.
let outboxBackoffUntil = 0;
let photoBackoffUntil = 0;

interface SyncOpResult {
  op_id: string;
  status: "applied" | "duplicate" | "rejected";
  reason?: string;
  record_id?: string;
}

export async function syncNow(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  // A tap that lands while a sync is in flight used to be dropped on the
  // floor — syncNow() returned immediately and the new op sat in the
  // outbox until the 30s interval came round. Mark it instead and run one
  // more pass after the current one, so marking three children in a row
  // syncs all three promptly.
  if (syncing) {
    rerunRequested = true;
    return;
  }

  syncing = true;
  try {
    do {
      rerunRequested = false;
      if (Date.now() >= outboxBackoffUntil) await pushOutbox();
      if (Date.now() >= photoBackoffUntil) await pushPhotos();
    } while (rerunRequested);
  } finally {
    syncing = false;
  }
}

/**
 * What the red "N ta yozuv yuborilmadi" bar's "Qayta urinish" button
 * calls. Plain syncNow() was not enough: it returns early while a backoff
 * is running, pushPhotos() only ever looks at `queued` photos so anything
 * already marked `failed` was never retried, and outbox ops past
 * MAX_SYNC_ATTEMPTS keep counting as failed. So the button looked like it
 * did nothing. Clearing the counters is what makes it a retry.
 */
export async function retryFailed(): Promise<void> {
  outboxBackoffUntil = 0;
  photoBackoffUntil = 0;

  const stuckOps = await db.outbox.filter((o) => o.attempts > 0).toArray();
  for (const op of stuckOps) {
    await db.outbox.update(op.op_id, { attempts: 0, last_error: undefined });
  }

  const failedPhotos = await db.photos.where("status").equals("failed").toArray();
  for (const photo of failedPhotos) {
    await db.photos.update(photo.photo_id, { status: "queued", attempts: 0 });
  }

  await syncNow();
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
  outboxBackoffUntil = Date.now() + BACKOFF_MS[delayIndex];
}

async function pushPhotos(): Promise<void> {
  // One at a time, deliberately — TZ §8.4: don't clog a mobile connection
  // with parallel uploads while attendance ops still need bandwidth.
  for (;;) {
    const photo = await db.photos.where("status").equals("queued").first();
    if (!photo) return;
    const more = await pushOnePhoto(photo);
    if (!more) return;
  }
}

/** Returns true when it's worth trying the next queued photo straight away. */
async function pushOnePhoto(photo: PendingPhoto): Promise<boolean> {
  await db.photos.update(photo.photo_id, { status: "uploading" });
  try {
    const compressed = await compressPhoto(photo.blob);

    // Hash what actually gets STORED, not the original camera blob.
    // /api/photos/attach re-hashes the uploaded bytes server-side (TZ
    // §7.7 — an evidence chain the client can dictate proves nothing),
    // so sending the pre-compression hash made every single upload fail
    // with HASH_MISMATCH. Worse, HASH_MISMATCH is treated as permanent
    // below, so each photo went straight to `failed` on its first try and
    // lit the red "N ta yozuv yuborilmadi" bar — while the attendance
    // marks themselves had synced fine. No photo had ever been attached.
    const sha256 = await sha256Hex(compressed);

    const sign = await apiPost<{ upload_url: string; path: string }>("/api/photos/sign", {
      photo_id: photo.photo_id,
      record_id: photo.record_id,
      child_id: photo.child_id,
      day_date: photo.day_date,
      sha256,
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
      sha256,
      bytes: compressed.size,
      taken_at: photo.taken_at,
    });

    await db.photos.update(photo.photo_id, { status: "done", sha256 });
    await db.records.update(photo.record_id, { has_photo: true });
    return true;
  } catch (err) {
    const attempts = photo.attempts + 1;
    // HASH_MISMATCH is permanent — the same blob will always hash the
    // same way, so retrying just burns bandwidth for nothing.
    // RECORD_NOT_FOUND is the opposite: the attendance op this photo
    // belongs to simply hasn't reached the server yet (offline, or its
    // batch is still in flight), so the photo has to wait for it rather
    // than burn an attempt on something that isn't its own fault.
    const code = err instanceof ApiClientError ? err.code : null;
    const permanent = code === "HASH_MISMATCH";
    const localRecord = code === "RECORD_NOT_FOUND"
      ? await db.records.get(photo.record_id)
      : undefined;
    // Only a record we know is still unsynced gets the free pass; if the
    // op has already been acknowledged and the server still can't find
    // it, that is a real failure and has to count toward the ceiling.
    const waitingForRecord = !!localRecord && !localRecord.synced;

    await db.photos.update(photo.photo_id, {
      status: permanent || attempts > MAX_SYNC_ATTEMPTS ? "failed" : "queued",
      attempts: waitingForRecord ? photo.attempts : attempts,
    });
    if (!permanent) {
      photoBackoffUntil = Date.now() + BACKOFF_MS[Math.min(photo.attempts, BACKOFF_MS.length - 1)];
    }
    return false;
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
