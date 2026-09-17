"use client";

import { db, type CachedChild } from "@/lib/offline/db";
import { sha256Hex } from "@/lib/crypto/sha256";
import type { AttendStatus } from "@/lib/db/types";
import { syncNow } from "@/lib/offline/sync";

/**
 * TZ §8.3 — the local write always lands first (UI updates immediately,
 * synchronously with this call returning), the network call is a
 * fire-and-forget nudge afterward. Mirrors the exact op shape
 * /api/sync/push expects so the sync engine can forward outbox rows
 * as-is.
 */
export async function markAttendance(
  child: CachedChild,
  status: AttendStatus,
  dayDate: string,
  photoBlob: Blob | null,
): Promise<string> {
  const recordId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.records.put({
    id: recordId,
    day_date: dayDate,
    child_id: child.id,
    status,
    client_marked_at: now,
    synced: false,
    has_photo: !!photoBlob,
  });

  if (photoBlob) {
    const sha256 = await sha256Hex(photoBlob);
    await db.photos.put({
      photo_id: crypto.randomUUID(),
      record_id: recordId,
      child_id: child.id,
      day_date: dayDate,
      blob: photoBlob,
      sha256,
      bytes: photoBlob.size,
      width: 0,
      height: 0,
      taken_at: now,
      attempts: 0,
      status: "queued",
    });
  }

  await db.outbox.put({
    op_id: crypto.randomUUID(),
    type: "attendance.mark",
    payload: { record_id: recordId, day_date: dayDate, child_id: child.id, status },
    client_at: now,
    attempts: 0,
    created_at: Date.now(),
  });

  void syncNow();
  return recordId;
}

export async function correctAttendance(
  childId: string,
  dayDate: string,
  status: AttendStatus,
  correctionNote: string,
): Promise<string> {
  const recordId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.records.put({
    id: recordId,
    day_date: dayDate,
    child_id: childId,
    status,
    client_marked_at: now,
    synced: false,
    has_photo: false,
  });

  await db.outbox.put({
    op_id: crypto.randomUUID(),
    type: "attendance.correct",
    payload: {
      record_id: recordId,
      day_date: dayDate,
      child_id: childId,
      status,
      correction_note: correctionNote,
    },
    client_at: now,
    attempts: 0,
    created_at: Date.now(),
  });

  void syncNow();
  return recordId;
}

export async function queueDayClose(dayDate: string): Promise<void> {
  await db.outbox.put({
    op_id: crypto.randomUUID(),
    type: "day.close",
    payload: { day_date: dayDate },
    client_at: new Date().toISOString(),
    attempts: 0,
    created_at: Date.now(),
  });
  void syncNow();
}
