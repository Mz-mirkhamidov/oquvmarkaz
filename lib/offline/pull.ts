"use client";

import { db } from "@/lib/offline/db";
import { apiGet } from "@/lib/api/client";
import type { AttendStatus, UserRole } from "@/lib/db/types";

interface PullResponse {
  server_time: string;
  cursor: string;
  org: { photo_required: boolean } | null;
  children: {
    id: string;
    group_id: string | null;
    full_name: string;
    avatar_path: string | null;
    state_system_id: string | null;
    photo_consent: boolean;
  }[];
  groups: { id: string; name: string }[];
  attendance_records: {
    child_id: string;
    status: AttendStatus;
    marked_at: string;
    note: string | null;
  }[];
  day_status: "open" | "closed" | "reopened";
  today: string;
  user_role: UserRole;
}

/**
 * Refreshes the local cache from /api/sync/pull. TZ §8.5's conflict rule:
 * server truth overwrites the local cache, but never an outbox entry
 * still waiting to be sent — that would erase a mark nobody's seen yet.
 */
export async function pullAndCache(): Promise<PullResponse> {
  const since = (await db.meta.get("last_pull_at"))?.value as string | undefined;
  const data = await apiGet<PullResponse>(
    since ? `/api/sync/pull?since=${encodeURIComponent(since)}` : "/api/sync/pull",
  );

  await db.children.bulkPut(
    data.children.map((c) => ({
      id: c.id,
      group_id: c.group_id,
      full_name: c.full_name,
      avatar_path: c.avatar_path,
      state_system_id: c.state_system_id,
      photo_consent: c.photo_consent,
    })),
  );
  await db.groups.bulkPut(data.groups);

  const pendingChildIds = new Set(
    (await db.outbox.toArray())
      .map((op) => (op.payload as { child_id?: string }).child_id)
      .filter((id): id is string => !!id),
  );

  for (const record of data.attendance_records) {
    if (pendingChildIds.has(record.child_id)) continue; // an unsynced local mark wins
    const existing = await db.records
      .where("[day_date+child_id]")
      .equals([data.today, record.child_id])
      .first();
    if (existing && !existing.synced) continue;
    await db.records.put({
      id: existing?.id ?? crypto.randomUUID(),
      day_date: data.today,
      child_id: record.child_id,
      status: record.status,
      client_marked_at: record.marked_at,
      synced: true,
      has_photo: existing?.has_photo ?? false,
    });
  }

  await db.meta.put({ key: "photo_required", value: data.org?.photo_required ?? true });
  await db.meta.put({ key: "last_pull_at", value: data.cursor });
  await db.meta.put({ key: "today", value: data.today });
  await db.meta.put({ key: "day_status", value: data.day_status });
  await db.meta.put({ key: "user_role", value: data.user_role });

  return data;
}
