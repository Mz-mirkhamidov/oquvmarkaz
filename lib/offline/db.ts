"use client";

import Dexie, { type Table } from "dexie";

import type { AttendStatus } from "@/lib/db/types";

// TZ §8.2 — the local database. Everything the app reads while marking
// attendance comes from here first; the network is an eventually-arriving
// detail, not something the UI waits on.

export interface OutboxOp {
  op_id: string;
  type: "attendance.mark" | "attendance.correct" | "day.close";
  payload: unknown;
  client_at: string;
  attempts: number;
  last_error?: string;
  created_at: number;
}

export interface PendingPhoto {
  photo_id: string;
  record_id: string;
  child_id: string;
  day_date: string;
  blob: Blob;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  taken_at: string;
  attempts: number;
  status: "queued" | "uploading" | "done" | "failed";
}

export interface CachedChild {
  id: string;
  group_id: string | null;
  full_name: string;
  avatar_path: string | null;
  state_system_id: string | null;
  photo_consent: boolean;
}

export interface CachedGroup {
  id: string;
  name: string;
}

export interface LocalRecord {
  id: string; // client record_id — becomes the DB primary key too
  day_date: string;
  child_id: string;
  status: AttendStatus;
  client_marked_at: string;
  synced: boolean;
  has_photo: boolean;
  rejected_reason?: string;
}

class QalqonDB extends Dexie {
  outbox!: Table<OutboxOp, string>;
  photos!: Table<PendingPhoto, string>;
  children!: Table<CachedChild, string>;
  groups!: Table<CachedGroup, string>;
  records!: Table<LocalRecord, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("qalqon");
    this.version(1).stores({
      outbox: "op_id, created_at, attempts",
      photos: "photo_id, status, record_id",
      children: "id, group_id",
      groups: "id",
      records: "id, [day_date+child_id], day_date, synced",
      meta: "key",
    });
  }
}

export const db = new QalqonDB();
