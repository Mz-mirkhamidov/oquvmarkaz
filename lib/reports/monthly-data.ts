import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database>;

export interface MonthlyReportData {
  org: { name: string };
  month: string; // YYYY-MM
  days: { day_date: string; status: string; total_count: number; present_count: number; absent_count: number; mismatch_count: number }[];
  children: { id: string; full_name: string }[];
  // status per child per day_date, e.g. grid.get(childId)?.get(dayDate)
  grid: Map<string, Map<string, string>>;
}

/** Feeds both the "Kunlik" and "Bolalar" sheets of the monthly XLSX register (TZ F-R*). */
export async function getMonthlyReportData(db: Db, orgId: string, month: string): Promise<MonthlyReportData> {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // first day of next month

  const [{ data: org }, { data: days }, { data: children }] = await Promise.all([
    db.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    db
      .from("attendance_days")
      .select("id, day_date, status, total_count, present_count, absent_count")
      .eq("org_id", orgId)
      .gte("day_date", monthStart)
      .lt("day_date", monthEnd)
      .order("day_date", { ascending: true }),
    db.from("children").select("id, full_name").eq("org_id", orgId).order("full_name", { ascending: true }),
  ]);

  const dayIds = (days ?? []).map((d) => d.id);
  const [{ data: records }, { data: mismatches }] = await Promise.all([
    dayIds.length > 0
      ? db
          .from("attendance_records")
          .select("day_id, child_id, status")
          .eq("is_current", true)
          .in("day_id", dayIds)
      : Promise.resolve({ data: [] as { day_id: string; child_id: string; status: string }[] }),
    dayIds.length > 0
      ? db.from("state_checks").select("day_id").eq("result", "rejected").in("day_id", dayIds)
      : Promise.resolve({ data: [] as { day_id: string }[] }),
  ]);

  const mismatchCountByDay = new Map<string, number>();
  for (const m of mismatches ?? []) {
    mismatchCountByDay.set(m.day_id, (mismatchCountByDay.get(m.day_id) ?? 0) + 1);
  }
  const dateByDayId = new Map((days ?? []).map((d) => [d.id, d.day_date]));

  const grid = new Map<string, Map<string, string>>();
  for (const r of records ?? []) {
    const date = dateByDayId.get(r.day_id);
    if (!date) continue;
    if (!grid.has(r.child_id)) grid.set(r.child_id, new Map());
    grid.get(r.child_id)!.set(date, r.status);
  }

  return {
    org: { name: org?.name ?? "" },
    month,
    days: (days ?? []).map((d) => ({
      day_date: d.day_date,
      status: d.status,
      total_count: d.total_count,
      present_count: d.present_count,
      absent_count: d.absent_count,
      mismatch_count: mismatchCountByDay.get(d.id) ?? 0,
    })),
    children: children ?? [],
    grid,
  };
}
