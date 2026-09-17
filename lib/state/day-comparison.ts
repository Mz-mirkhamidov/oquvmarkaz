import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

export interface StateComparisonRow {
  child_id: string;
  full_name: string;
  group_id: string | null;
  our_status: string | null; // null = the child has no current record that day
  check: {
    id: string;
    result: string;
    reason: string | null;
    note: string | null;
    checked_at: string | null;
  } | null;
}

/** Shared by GET/PUT /api/state/[date] and the /hisobot/[sana] screen — TZ's state-system comparison (F-S*). */
export async function getStateComparisonView(
  db: SupabaseClient<Database>,
  orgId: string,
  dayDate: string,
) {
  const { data: day } = await db
    .from("attendance_days")
    .select("*")
    .eq("org_id", orgId)
    .eq("day_date", dayDate)
    .maybeSingle();

  const { data: children } = await db
    .from("children")
    .select("id, full_name, group_id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  let records: { child_id: string; status: string }[] = [];
  let checks: {
    id: string;
    child_id: string;
    result: string;
    reason: string | null;
    note: string | null;
    checked_at: string | null;
  }[] = [];
  if (day) {
    const [{ data: recordData }, { data: checkData }] = await Promise.all([
      db
        .from("attendance_records")
        .select("child_id, status")
        .eq("day_id", day.id)
        .eq("is_current", true),
      db
        .from("state_checks")
        .select("id, child_id, result, reason, note, checked_at")
        .eq("day_id", day.id),
    ]);
    records = recordData ?? [];
    checks = checkData ?? [];
  }
  const statusByChild = new Map(records.map((r) => [r.child_id, r.status]));
  const checkByChild = new Map(checks.map((c) => [c.child_id, c]));

  const rows: StateComparisonRow[] = (children ?? []).map((c) => {
    const check = checkByChild.get(c.id);
    return {
      child_id: c.id,
      full_name: c.full_name,
      group_id: c.group_id,
      our_status: statusByChild.get(c.id) ?? null,
      check: check
        ? {
            id: check.id,
            result: check.result,
            reason: check.reason,
            note: check.note,
            checked_at: check.checked_at,
          }
        : null,
    };
  });

  return {
    date: dayDate,
    day,
    rows,
    mismatch_count: rows.filter((r) => r.check?.result === "rejected").length,
  };
}
