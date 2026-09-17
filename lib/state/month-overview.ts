import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database>;

export interface MonthDayOverview {
  day_date: string;
  status: string;
  total_count: number;
  present_count: number;
  mismatch_count: number;
}

/** Feeds the /hisobot hub's day list — one row per opened day in the month, with its mismatch count. */
export async function getMonthOverview(db: Db, orgId: string, month: string): Promise<MonthDayOverview[]> {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const { data: days } = await db
    .from("attendance_days")
    .select("id, day_date, status, total_count, present_count")
    .eq("org_id", orgId)
    .gte("day_date", monthStart)
    .lt("day_date", monthEnd)
    .order("day_date", { ascending: true });

  const dayIds = (days ?? []).map((d) => d.id);
  const { data: mismatches } =
    dayIds.length > 0
      ? await db.from("state_checks").select("day_id").eq("result", "rejected").in("day_id", dayIds)
      : { data: [] as { day_id: string }[] };

  const countByDay = new Map<string, number>();
  for (const m of mismatches ?? []) countByDay.set(m.day_id, (countByDay.get(m.day_id) ?? 0) + 1);

  return (days ?? []).map((d) => ({
    day_date: d.day_date,
    status: d.status,
    total_count: d.total_count,
    present_count: d.present_count,
    mismatch_count: countByDay.get(d.id) ?? 0,
  }));
}
