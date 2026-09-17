import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { StateChecksUpsertInput } from "@/lib/schemas/state";

type Db = SupabaseClient<Database>;

export class StateCheckError extends Error {
  constructor(public code: "DAY_NOT_FOUND" | "CHILD_NOT_FOUND" | "DB_ERROR") {
    super(code);
  }
}

/**
 * Records the state system's verdict for each child on a day (TZ F-S*).
 * `our_status` is a snapshot of what we had on file at check time — the
 * comparison is only meaningful against the record as it stood, even if
 * it's corrected later. `result: 'rejected'` is the mismatch signal the
 * rest of the app (idx_state_mismatch, dispute creation) keys off.
 */
export async function upsertStateChecks(
  db: Db,
  orgId: string,
  userId: string,
  dayDate: string,
  input: StateChecksUpsertInput,
) {
  const { data: day } = await db
    .from("attendance_days")
    .select("id")
    .eq("org_id", orgId)
    .eq("day_date", dayDate)
    .maybeSingle();
  if (!day) throw new StateCheckError("DAY_NOT_FOUND");

  const childIds = input.items.map((i) => i.child_id);
  const { data: children } = await db
    .from("children")
    .select("id")
    .eq("org_id", orgId)
    .in("id", childIds);
  const validChildIds = new Set((children ?? []).map((c) => c.id));
  if (validChildIds.size !== new Set(childIds).size) throw new StateCheckError("CHILD_NOT_FOUND");

  const { data: records } = await db
    .from("attendance_records")
    .select("child_id, status")
    .eq("day_id", day.id)
    .eq("is_current", true)
    .in("child_id", childIds);
  const statusByChild = new Map((records ?? []).map((r) => [r.child_id, r.status]));

  const now = new Date().toISOString();
  const rows = input.items.map((item) => ({
    org_id: orgId,
    day_id: day.id,
    child_id: item.child_id,
    our_status: statusByChild.get(item.child_id) ?? ("absent" as const),
    result: item.result,
    reason: item.result === "rejected" ? (item.reason ?? "boshqa") : null,
    note: item.note ?? null,
    checked_at: now,
    checked_by: userId,
  }));

  const { error } = await db.from("state_checks").upsert(rows, { onConflict: "day_id,child_id" });
  if (error) throw new StateCheckError("DB_ERROR");

  return { day_id: day.id, rows };
}
