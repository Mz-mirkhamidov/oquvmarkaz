import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database>;

export interface DisputeEvidenceRow {
  child_name: string;
  day_date: string;
  our_status: string;
  reason: string | null;
  note: string | null;
  checked_at: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
  photo_sha256: string | null;
}

export interface DisputeEvidence {
  dispute: {
    id: string;
    title: string;
    period_month: string;
    affected_children: number;
    affected_days: number;
    estimated_amount: number | null;
    status: string;
    bundle_code: string | null;
  };
  org: { name: string; region: string | null; district: string | null };
  rows: DisputeEvidenceRow[];
}

/** Assembles everything a dispute PDF bundle needs to prove its claim — TZ §7.7's evidence chain, read-side. */
export async function getDisputeEvidence(
  db: Db,
  orgId: string,
  disputeId: string,
): Promise<DisputeEvidence | null> {
  const { data: dispute } = await db
    .from("disputes")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", disputeId)
    .maybeSingle();
  if (!dispute) return null;

  const { data: org } = await db
    .from("organizations")
    .select("name, region, district")
    .eq("id", orgId)
    .maybeSingle();

  const { data: items } = await db.from("dispute_items").select("check_id").eq("dispute_id", disputeId);
  const checkIds = (items ?? []).map((i) => i.check_id);
  if (checkIds.length === 0) {
    return { dispute, org: org ?? { name: "", region: null, district: null }, rows: [] };
  }

  const { data: checks } = await db
    .from("state_checks")
    .select("child_id, day_id, our_status, reason, note, checked_at")
    .in("id", checkIds);

  const childIds = [...new Set((checks ?? []).map((c) => c.child_id))];
  const dayIds = [...new Set((checks ?? []).map((c) => c.day_id))];

  const [{ data: children }, { data: days }, { data: records }] = await Promise.all([
    db.from("children").select("id, full_name").in("id", childIds),
    db.from("attendance_days").select("id, day_date").in("id", dayIds),
    db
      .from("attendance_records")
      .select("id, day_id, child_id, marked_at, marked_by")
      .eq("is_current", true)
      .in("day_id", dayIds)
      .in("child_id", childIds),
  ]);

  const nameByChild = new Map((children ?? []).map((c) => [c.id, c.full_name]));
  const dateByDay = new Map((days ?? []).map((d) => [d.id, d.day_date]));
  const recordByKey = new Map((records ?? []).map((r) => [`${r.day_id}|${r.child_id}`, r]));

  const markedByIds = [...new Set((records ?? []).map((r) => r.marked_by).filter((v): v is string => !!v))];
  const recordIds = (records ?? []).map((r) => r.id);
  const [{ data: markers }, { data: photos }] = await Promise.all([
    markedByIds.length > 0
      ? db.from("app_users").select("id, full_name").in("id", markedByIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    recordIds.length > 0
      ? db.from("attendance_photos").select("record_id, sha256").in("record_id", recordIds)
      : Promise.resolve({ data: [] as { record_id: string; sha256: string }[] }),
  ]);
  const nameByUser = new Map((markers ?? []).map((m) => [m.id, m.full_name]));
  const photoByRecord = new Map((photos ?? []).map((p) => [p.record_id, p.sha256]));

  const rows: DisputeEvidenceRow[] = (checks ?? [])
    .map((c) => {
      const record = recordByKey.get(`${c.day_id}|${c.child_id}`);
      return {
        child_name: nameByChild.get(c.child_id) ?? c.child_id,
        day_date: dateByDay.get(c.day_id) ?? c.day_id,
        our_status: c.our_status,
        reason: c.reason,
        note: c.note,
        checked_at: c.checked_at,
        marked_at: record?.marked_at ?? null,
        marked_by_name: record?.marked_by ? (nameByUser.get(record.marked_by) ?? null) : null,
        photo_sha256: record ? (photoByRecord.get(record.id) ?? null) : null,
      };
    })
    .sort((a, b) => a.day_date.localeCompare(b.day_date) || a.child_name.localeCompare(b.child_name));

  return { dispute, org: org ?? { name: "", region: null, district: null }, rows };
}
