import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

/** Shared by /api/attendance/today and /api/attendance/[date] — RLS on `children` already scopes a teacher to their own group. */
export async function getDayView(
  db: SupabaseClient<Database>,
  orgId: string,
  dayDate: string,
) {
  const [{ data: day }, { data: children }, { data: groups }] = await Promise.all([
    db.from("attendance_days").select("*").eq("org_id", orgId).eq("day_date", dayDate).maybeSingle(),
    db
      .from("children")
      .select("id, full_name, group_id, avatar_path, state_system_id, photo_consent")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    // RLS allows any org member to read groups (only the /api/groups route
    // itself is manager-gated) — the davomat screen's group picker needs
    // names even for a teacher viewing just their own group.
    db.from("groups").select("id, name").eq("org_id", orgId).eq("is_active", true),
  ]);

  let records: { child_id: string; status: string; marked_at: string; note: string | null }[] = [];
  if (day) {
    const { data } = await db
      .from("attendance_records")
      .select("child_id, status, marked_at, note")
      .eq("day_id", day.id)
      .eq("is_current", true);
    records = data ?? [];
  }
  const byChild = new Map(records.map((r) => [r.child_id, r]));

  return {
    day,
    children: (children ?? []).map((c) => ({ ...c, record: byChild.get(c.id) ?? null })),
    groups: groups ?? [],
  };
}
