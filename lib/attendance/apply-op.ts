import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { SyncOp, SyncOpResult } from "@/lib/schemas/sync";
import { enqueueAttendanceNotification } from "@/lib/notifications/enqueue";

type Db = SupabaseClient<Database>;

export class RejectedOpError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

interface ApplyContext {
  db: Db; // RLS-scoped (per-request JWT) — used for everything except sync_ops (see 0002_rls.sql)
  orgId: string;
  userId: string;
  deviceId?: string;
}

async function notifyGuardians(
  orgId: string,
  childId: string,
  childName: string,
  dayDate: string,
  status: "present" | "absent" | "sick" | "vacation",
): Promise<void> {
  try {
    if (status === "present") {
      await enqueueAttendanceNotification(orgId, childId, {
        kind: "arrival",
        child_name: childName,
        day_date: dayDate,
        marked_at: new Date().toISOString(),
      });
    } else {
      await enqueueAttendanceNotification(orgId, childId, {
        kind: "absent",
        child_name: childName,
        day_date: dayDate,
        status,
      });
    }
  } catch (err) {
    console.error("notify_guardians_error", err);
  }
}

async function getOrCreateDay(db: Db, orgId: string, dayDate: string) {
  const { data: existing } = await db
    .from("attendance_days")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("day_date", dayDate)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await db
    .from("attendance_days")
    .insert({ org_id: orgId, day_date: dayDate })
    .select("id, status")
    .single();
  if (created) return created;

  // Race: another request created it between our select and insert
  // (unique(org_id, day_date)) — re-read instead of failing.
  if (error?.code === "23505") {
    const { data: retry } = await db
      .from("attendance_days")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("day_date", dayDate)
      .maybeSingle();
    if (retry) return retry;
  }
  throw new RejectedOpError("db_error");
}

async function applyMark(op: Extract<SyncOp, { type: "attendance.mark" }>, ctx: ApplyContext) {
  const { db, orgId, userId, deviceId } = ctx;
  const { child_id, day_date, status, note, record_id } = op.payload;

  const { data: child } = await db
    .from("children")
    .select("id, full_name")
    .eq("id", child_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!child) throw new RejectedOpError("forbidden");

  const day = await getOrCreateDay(db, orgId, day_date);
  if (day.status === "closed") throw new RejectedOpError("day_closed");

  const { data: current } = await db
    .from("attendance_records")
    .select("id")
    .eq("day_id", day.id)
    .eq("child_id", child_id)
    .eq("is_current", true)
    .maybeSingle();

  if (!current) {
    const { error } = await db.from("attendance_records").insert({
      id: record_id,
      org_id: orgId,
      day_id: day.id,
      child_id,
      status,
      marked_by: userId,
      device_id: deviceId,
      client_marked_at: op.client_at,
      note: note ?? null,
    });
    if (error) {
      if (error.code === "23505") return { status: "duplicate" as const };
      if (error.message?.includes("DAY_CLOSED")) throw new RejectedOpError("day_closed");
      throw new RejectedOpError("db_error");
    }

    // Fire-and-forget — a linked parent's notification is a courtesy, not
    // part of the attendance write itself; never let it fail the op. Only
    // a fresh mark notifies (not a same-day re-tap below, or a correction
    // in applyCorrect) so a parent gets exactly one ping per status.
    void notifyGuardians(orgId, child_id, child.full_name, day_date, status);
    return { status: "applied" as const, record_id };
  }

  // Same-day re-tap: change status via the supersede function (no note).
  const { data: result, error } = await db.rpc("supersede_attendance_record", {
    p_new_id: record_id,
    p_org_id: orgId,
    p_day_id: day.id,
    p_child_id: child_id,
    p_status: status,
    p_marked_by: userId,
    p_device_id: deviceId ?? null,
    p_client_marked_at: op.client_at,
    p_note: note ?? null,
    p_correction_note: null,
  });
  if (error) {
    if (error.message?.includes("FORBIDDEN")) throw new RejectedOpError("forbidden");
    throw new RejectedOpError("db_error");
  }
  return { status: "applied" as const, record_id: result?.id ?? record_id };
}

async function applyCorrect(op: Extract<SyncOp, { type: "attendance.correct" }>, ctx: ApplyContext) {
  const { db, orgId, userId, deviceId } = ctx;
  const { child_id, day_date, status, correction_note, record_id } = op.payload;

  const { data: child } = await db
    .from("children")
    .select("id")
    .eq("id", child_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!child) throw new RejectedOpError("forbidden");

  const { data: day } = await db
    .from("attendance_days")
    .select("id")
    .eq("org_id", orgId)
    .eq("day_date", day_date)
    .maybeSingle();
  if (!day) throw new RejectedOpError("day_not_found");

  const { data: result, error } = await db.rpc("supersede_attendance_record", {
    p_new_id: record_id,
    p_org_id: orgId,
    p_day_id: day.id,
    p_child_id: child_id,
    p_status: status,
    p_marked_by: userId,
    p_device_id: deviceId ?? null,
    p_client_marked_at: op.client_at,
    p_note: null,
    p_correction_note: correction_note,
  });
  if (error) {
    if (error.code === "23505") return { status: "duplicate" as const };
    if (error.message?.includes("FORBIDDEN")) throw new RejectedOpError("forbidden");
    throw new RejectedOpError("db_error");
  }
  return { status: "applied" as const, record_id: result?.id ?? record_id };
}

/** Day seal (TZ §11.6): rolling SHA-256 over every current record's (id, child, status, marked_at, photo hash). */
export async function computeDaySeal(db: Db, dayId: string): Promise<string> {
  const { data: records } = await db
    .from("attendance_records")
    .select("id, child_id, status, marked_at")
    .eq("day_id", dayId)
    .eq("is_current", true)
    .order("id", { ascending: true });

  const { data: photos } = await db
    .from("attendance_photos")
    .select("record_id, sha256")
    .in("record_id", (records ?? []).map((r) => r.id));
  const photoHash = new Map((photos ?? []).map((p) => [p.record_id, p.sha256]));

  const canonical = (records ?? [])
    .map((r) => `${r.id}|${r.child_id}|${r.status}|${r.marked_at}|${photoHash.get(r.id) ?? ""}`)
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Marks every unmarked active child absent, seals the day (§11.6), and
 * closes it. Shared by the day.close sync op and POST /api/attendance/close
 * — idempotent (returns `already_closed` instead of re-closing).
 */
export async function closeDay(
  db: Db,
  orgId: string,
  userId: string,
  deviceId: string | undefined,
  dayDate: string,
  clientAt: string,
): Promise<{ alreadyClosed: boolean; dayId: string }> {
  const day = await getOrCreateDay(db, orgId, dayDate);
  if (day.status === "closed") return { alreadyClosed: true, dayId: day.id };

  const { data: children } = await db
    .from("children")
    .select("id, full_name")
    .eq("org_id", orgId)
    .eq("is_active", true);

  const { data: currentRecords } = await db
    .from("attendance_records")
    .select("child_id")
    .eq("day_id", day.id)
    .eq("is_current", true);
  const markedChildIds = new Set((currentRecords ?? []).map((r) => r.child_id));

  const unmarked = (children ?? []).filter((c) => !markedChildIds.has(c.id));
  if (unmarked.length > 0) {
    const { error } = await db.from("attendance_records").insert(
      unmarked.map((c) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        day_id: day.id,
        child_id: c.id,
        status: "absent" as const,
        marked_by: userId,
        device_id: deviceId,
        client_marked_at: clientAt,
      })),
    );
    if (error) throw new RejectedOpError("db_error");

    for (const c of unmarked) {
      void notifyGuardians(orgId, c.id, c.full_name, dayDate, "absent");
    }
  }

  const seal = await computeDaySeal(db, day.id);

  const { error: closeError } = await db
    .from("attendance_days")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: userId,
      day_seal: seal,
      sealed_at: new Date().toISOString(),
    })
    .eq("id", day.id);
  if (closeError) throw new RejectedOpError("db_error");

  return { alreadyClosed: false, dayId: day.id };
}

async function applyDayClose(op: Extract<SyncOp, { type: "day.close" }>, ctx: ApplyContext) {
  await closeDay(ctx.db, ctx.orgId, ctx.userId, ctx.deviceId, op.payload.day_date, op.client_at);
  return { status: "applied" as const };
}

export async function applyOp(op: SyncOp, ctx: ApplyContext): Promise<SyncOpResult> {
  try {
    let outcome: { status: "applied" | "duplicate"; record_id?: string };
    if (op.type === "attendance.mark") outcome = await applyMark(op, ctx);
    else if (op.type === "attendance.correct") outcome = await applyCorrect(op, ctx);
    else outcome = await applyDayClose(op, ctx);
    return { op_id: op.op_id, ...outcome };
  } catch (err) {
    const reason = err instanceof RejectedOpError ? err.reason : "unknown_error";
    return { op_id: op.op_id, status: "rejected", reason };
  }
}
