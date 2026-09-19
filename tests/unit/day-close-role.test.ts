import { describe, expect, it, vi } from "vitest";

import { applyOp } from "@/lib/attendance/apply-op";
import type { SyncOp } from "@/lib/schemas/sync";
import type { UserRole } from "@/lib/db/types";

// Closing a day is org-wide and one-way: every unmarked active child in
// the whole organization is marked absent and the day is sealed, after
// which only a written correction can change anything — and only a
// manager can reopen it. POST /api/attendance/close guards this with
// requireManager(), but the offline outbox is a second way into the same
// code, so applyOp has to mirror the check. These tests pin that: a
// teacher's queued day.close op must be rejected before it reaches the
// database at all.

const closeOp: Extract<SyncOp, { type: "day.close" }> = {
  op_id: "11111111-1111-1111-1111-111111111111",
  type: "day.close",
  client_at: "2026-09-19T08:00:00.000Z",
  payload: { day_date: "2026-09-19" },
};

function ctxFor(userRole: UserRole) {
  // If the role gate does its job, nothing on `db` is ever touched — any
  // property access here would throw and fail the test loudly.
  const db = new Proxy(
    {},
    {
      get() {
        throw new Error("the database must not be touched for a rejected day.close");
      },
    },
  );
  return {
    db: db as never,
    orgId: "22222222-2222-2222-2222-222222222222",
    userId: "33333333-3333-3333-3333-333333333333",
    userRole,
    deviceId: undefined,
  };
}

describe("day.close role gate", () => {
  it("rejects a teacher's day.close op without touching the database", async () => {
    const result = await applyOp(closeOp, ctxFor("teacher"));

    expect(result).toEqual({
      op_id: closeOp.op_id,
      status: "rejected",
      reason: "forbidden",
    });
  });

  for (const role of ["owner", "director"] as const) {
    it(`lets a ${role} through to closeDay`, async () => {
      // Far enough to prove the gate opened: getOrCreateDay is the first
      // thing closeDay does, so reaching it means the role check passed.
      const maybeSingle = vi.fn(async () => ({ data: { id: "day", status: "open" } }));
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle,
      };
      const db = { from: vi.fn(() => chain) };

      const result = await applyOp(closeOp, { ...ctxFor(role), db: db as never });

      expect(db.from).toHaveBeenCalledWith("attendance_days");
      // The stub can't carry the rest of closeDay, so it ends in
      // db_error — what matters is that it got past the gate, which
      // "forbidden" would not have.
      expect(result).not.toMatchObject({ reason: "forbidden" });
    });
  }
});
