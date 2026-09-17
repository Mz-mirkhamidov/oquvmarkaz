import { z } from "zod";

import { attendStatusSchema } from "@/lib/schemas/attendance";

const attendanceMarkPayload = z.object({
  record_id: z.uuid(),
  day_date: z.iso.date(),
  child_id: z.uuid(),
  status: attendStatusSchema,
  note: z.string().max(500).nullable().optional(),
});

// Only for a day that's already closed — see 0006_attendance_corrections.sql
// for why attendance.mark (same-day re-tap) and attendance.correct
// (past-day fix) both go through the same supersede function but differ
// on whether a note is required and whether a closed day accepts them.
const attendanceCorrectPayload = z.object({
  record_id: z.uuid(),
  day_date: z.iso.date(),
  child_id: z.uuid(),
  status: attendStatusSchema,
  correction_note: z.string().trim().min(3).max(500),
});

const dayClosePayload = z.object({
  day_date: z.iso.date(),
});

export const syncOpSchema = z.discriminatedUnion("type", [
  z.object({
    op_id: z.uuid(),
    type: z.literal("attendance.mark"),
    client_at: z.iso.datetime(),
    payload: attendanceMarkPayload,
  }),
  z.object({
    op_id: z.uuid(),
    type: z.literal("attendance.correct"),
    client_at: z.iso.datetime(),
    payload: attendanceCorrectPayload,
  }),
  z.object({
    op_id: z.uuid(),
    type: z.literal("day.close"),
    client_at: z.iso.datetime(),
    payload: dayClosePayload,
  }),
]);
export type SyncOp = z.infer<typeof syncOpSchema>;

// TZ §7.5 — max 200 ops per request, client splits larger batches itself.
export const syncPushSchema = z.object({
  device_key: z.string().trim().min(8).max(128),
  ops: z.array(syncOpSchema).min(1).max(200),
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export type SyncOpResult =
  | { op_id: string; status: "applied"; record_id?: string }
  | { op_id: string; status: "duplicate" }
  | { op_id: string; status: "rejected"; reason: string };
