import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { DisputeCreateInput } from "@/lib/schemas/dispute";

type Db = SupabaseClient<Database>;

export class DisputeCreateError extends Error {
  constructor(public code: "NO_MISMATCHES" | "ALREADY_CLAIMED" | "DB_ERROR") {
    super(code);
  }
}

/**
 * A dispute bundles the rejected state_checks the director wants to
 * contest (F-S* / F-R*). RLS already scopes state_checks to the caller's
 * org, so any row `.in("id", check_ids)` returns is provably theirs —
 * this only needs to confirm every requested id actually resolved AND
 * that it's a mismatch (`result = 'rejected'`), not already attached to
 * another dispute (dispute_items has no unique constraint enforcing that,
 * so it's a manual check here).
 */
export async function createDispute(db: Db, orgId: string, userId: string, input: DisputeCreateInput) {
  const { data: checks } = await db
    .from("state_checks")
    .select("id, child_id, day_id")
    .eq("org_id", orgId)
    .eq("result", "rejected")
    .in("id", input.check_ids);
  if (!checks || checks.length !== input.check_ids.length) {
    throw new DisputeCreateError("NO_MISMATCHES");
  }

  const { data: existingItems } = await db
    .from("dispute_items")
    .select("check_id")
    .in("check_id", input.check_ids);
  if (existingItems && existingItems.length > 0) throw new DisputeCreateError("ALREADY_CLAIMED");

  const affectedChildren = new Set(checks.map((c) => c.child_id)).size;
  const affectedDays = new Set(checks.map((c) => c.day_id)).size;

  const { data: dispute, error } = await db
    .from("disputes")
    .insert({
      org_id: orgId,
      period_month: input.period_month,
      title: input.title,
      affected_children: affectedChildren,
      affected_days: affectedDays,
      estimated_amount: input.estimated_amount ?? null,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !dispute) throw new DisputeCreateError("DB_ERROR");

  const { error: itemsError } = await db
    .from("dispute_items")
    .insert(checks.map((c) => ({ dispute_id: dispute.id, check_id: c.id })));
  if (itemsError) throw new DisputeCreateError("DB_ERROR");

  return dispute;
}
