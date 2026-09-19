// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { pool, resetDatabase, seed, withTenant, type JwtClaims } from "./setup";

// State-system comparison and disputes (M5, TZ F-S* / F-R*). Same real-Postgres
// approach as tenant-isolation.spec.ts — see that file for why.

let dbAvailable = true;
try {
  await resetDatabase();
} catch (err) {
  dbAvailable = false;
  console.warn("state tests skipped — no reachable Postgres (set TEST_DATABASE_URL):", (err as Error).message);
}

afterAll(async () => {
  await pool.end().catch(() => {});
});

async function seedOrgWithManagerTeacherAndDay(orgName = "Test bogcha") {
  const orgId = randomUUID();
  const managerId = randomUUID();
  const teacherId = randomUUID();
  const childId = randomUUID();
  const dayId = randomUUID();

  await seed(`insert into organizations (id, name, org_type) values ($1, $2, 'oilaviy')`, [orgId, orgName]);
  await seed(
    `insert into "user" (id, name, email, "emailVerified", "fullName", "appRole", "orgId", "telegramId", "isActive")
     values ($1, 'Owner', $2, true, 'Owner', 'owner', $3, $4, true)`,
    [managerId, `owner-${managerId}@test.local`, orgId, String(Math.floor(Math.random() * 1e9))],
  );
  await seed(
    `insert into "user" (id, name, email, "emailVerified", "fullName", "appRole", "orgId", "pinHash", "isActive")
     values ($1, 'Teacher', $2, true, 'Teacher', 'teacher', $3, 'x', true)`,
    [teacherId, `teacher-${teacherId}@test.local`, orgId],
  );
  await seed(`insert into children (id, org_id, full_name) values ($1, $2, 'Test Child')`, [childId, orgId]);
  await seed(`insert into attendance_days (id, org_id, day_date) values ($1, $2, current_date)`, [dayId, orgId]);
  await seed(
    `insert into attendance_records (id, org_id, day_id, child_id, status) values ($1, $2, $3, $4, 'present')`,
    [randomUUID(), orgId, dayId, childId],
  );

  const managerClaims: JwtClaims = { sub: managerId, org_id: orgId, user_role: "owner" };
  const teacherClaims: JwtClaims = { sub: teacherId, org_id: orgId, user_role: "teacher" };
  return { orgId, managerId, teacherId, childId, dayId, managerClaims, teacherClaims };
}

describe.runIf(dbAvailable)("state_checks RLS", () => {
  it("a manager can insert a state_check for their own org", async () => {
    const { orgId, dayId, childId, managerClaims } = await seedOrgWithManagerTeacherAndDay();

    // withTenant rolls back at the end of each call (its own transaction),
    // so the write and the read that proves it happened must share one call.
    const rows = await withTenant(managerClaims, async (client) => {
      await client.query(
        `insert into state_checks (org_id, day_id, child_id, our_status, result)
         values ($1, $2, $3, 'present', 'accepted')`,
        [orgId, dayId, childId],
      );
      return client.query("select id from state_checks where day_id = $1", [dayId]);
    });
    expect(rows.rows).toHaveLength(1);
  });

  it("a teacher cannot insert a state_check (manager-only per TZ)", async () => {
    const { orgId, dayId, childId, teacherClaims } = await seedOrgWithManagerTeacherAndDay();

    await expect(
      withTenant(teacherClaims, (client) =>
        client.query(
          `insert into state_checks (org_id, day_id, child_id, our_status, result)
           values ($1, $2, $3, 'present', 'accepted')`,
          [orgId, dayId, childId],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("org A cannot see org B's state_checks", async () => {
    const a = await seedOrgWithManagerTeacherAndDay("Org A");
    const b = await seedOrgWithManagerTeacherAndDay("Org B");

    await seed(
      `insert into state_checks (org_id, day_id, child_id, our_status, result)
       values ($1, $2, $3, 'present', 'rejected')`,
      [b.orgId, b.dayId, b.childId],
    );

    const rows = await withTenant(a.managerClaims, (client) =>
      client.query("select id from state_checks where org_id = $1", [b.orgId]),
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe.runIf(dbAvailable)("disputes RLS", () => {
  async function seedRejectedCheck(orgId: string, dayId: string, childId: string) {
    const checkId = randomUUID();
    await seed(
      `insert into state_checks (id, org_id, day_id, child_id, our_status, result, reason)
       values ($1, $2, $3, $4, 'present', 'rejected', 'xatolik')`,
      [checkId, orgId, dayId, childId],
    );
    return checkId;
  }

  it("a teacher cannot create a dispute", async () => {
    const { orgId, teacherClaims } = await seedOrgWithManagerTeacherAndDay();

    await expect(
      withTenant(teacherClaims, (client) =>
        client.query(`insert into disputes (org_id, period_month, title) values ($1, current_date, 'X')`, [
          orgId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("a manager cannot attach another org's state_check to their dispute (0009 hardening)", async () => {
    const a = await seedOrgWithManagerTeacherAndDay("Org A");
    const b = await seedOrgWithManagerTeacherAndDay("Org B");
    const otherOrgCheckId = await seedRejectedCheck(b.orgId, b.dayId, b.childId);

    const disputeId = randomUUID();
    await seed(`insert into disputes (id, org_id, period_month, title) values ($1, $2, current_date, 'X')`, [
      disputeId,
      a.orgId,
    ]);

    await expect(
      withTenant(a.managerClaims, (client) =>
        client.query(`insert into dispute_items (dispute_id, check_id) values ($1, $2)`, [
          disputeId,
          otherOrgCheckId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("a manager can attach their own org's rejected check to their dispute", async () => {
    const { orgId, dayId, childId, managerClaims } = await seedOrgWithManagerTeacherAndDay();
    const checkId = await seedRejectedCheck(orgId, dayId, childId);

    const disputeId = randomUUID();
    await seed(`insert into disputes (id, org_id, period_month, title) values ($1, $2, current_date, 'X')`, [
      disputeId,
      orgId,
    ]);

    const rows = await withTenant(managerClaims, async (client) => {
      await client.query(`insert into dispute_items (dispute_id, check_id) values ($1, $2)`, [
        disputeId,
        checkId,
      ]);
      return client.query("select check_id from dispute_items where dispute_id = $1", [disputeId]);
    });
    expect(rows.rows).toHaveLength(1);
  });
});

// Both of these were live gaps found by walking the close -> report ->
// state-comparison -> dispute chain against a real database. Neither was
// reachable from a browser (the PostgREST bearer is minted per request and
// never leaves the server, and every route above is requireManager), but
// RLS is this app's stated security boundary and both are one careless new
// route away from mattering. Fixed in 0015_day_status_guard.sql.
describe.runIf(dbAvailable)("day status and seal are manager-only (0015)", () => {
  it("a teacher cannot reopen a closed day", async () => {
    const { dayId, teacherId, teacherClaims } = await seedOrgWithManagerTeacherAndDay();
    await seed(`update attendance_days set status = 'closed' where id = $1`, [dayId]);

    // `days_update` only ever checked org_id, so this used to succeed —
    // the manager-only rule lived solely in /api/attendance/reopen.
    await expect(
      withTenant(teacherClaims, (client) =>
        client.query(
          `update attendance_days set status = 'reopened', reopened_by = $2 where id = $1`,
          [dayId, teacherId],
        ),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("a teacher cannot overwrite the day seal", async () => {
    const { dayId, teacherClaims } = await seedOrgWithManagerTeacherAndDay();
    await seed(`update attendance_days set status = 'closed', day_seal = 'real-seal' where id = $1`, [
      dayId,
    ]);

    // TZ §11.6: the seal is the evidence chain. Anyone who can rewrite it
    // can rewrite history.
    await expect(
      withTenant(teacherClaims, (client) =>
        client.query(`update attendance_days set day_seal = 'forged' where id = $1`, [dayId]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("a manager can still close and reopen", async () => {
    const { dayId, managerId, managerClaims } = await seedOrgWithManagerTeacherAndDay();

    const rows = await withTenant(managerClaims, async (client) => {
      await client.query(
        `update attendance_days set status = 'closed', closed_by = $2, day_seal = 'seal' where id = $1`,
        [dayId, managerId],
      );
      await client.query(`update attendance_days set status = 'reopened', reopen_reason = 'x' where id = $1`, [
        dayId,
      ]);
      return client.query("select status from attendance_days where id = $1", [dayId]);
    });
    expect(rows.rows[0].status).toBe("reopened");
  });

  it("a teacher can still mark attendance (the counts trigger updates the day)", async () => {
    // The guard has to let this through: refresh_day_counts() is a
    // SECURITY INVOKER trigger that UPDATEs attendance_days on every mark,
    // so a blanket manager-only rule on that table would break the app's
    // core function for the people who use it most.
    const { orgId, dayId, teacherId, teacherClaims } = await seedOrgWithManagerTeacherAndDay();
    const otherChild = randomUUID();
    await seed(`insert into children (id, org_id, full_name) values ($1, $2, 'Boshqa')`, [otherChild, orgId]);

    const rows = await withTenant(teacherClaims, async (client) => {
      await client.query(
        `insert into attendance_records (id, org_id, day_id, child_id, status, marked_by)
         values ($1, $2, $3, $4, 'present', $5)`,
        [randomUUID(), orgId, dayId, otherChild, teacherId],
      );
      return client.query("select present_count from attendance_days where id = $1", [dayId]);
    });
    expect(Number(rows.rows[0].present_count)).toBe(2);
  });

  it("a write with no JWT claims at all is left alone (service_role, cron, migrations)", async () => {
    // The first version of the guard read the role through
    // auth_user_role(), which casts current_setting(...) to jsonb. On the
    // service_role path that setting is an empty string, and the cast blew
    // up with "invalid input syntax for type json" — closing a day would
    // have failed in production.
    const { dayId } = await seedOrgWithManagerTeacherAndDay();
    await seed(`select set_config('request.jwt.claims', '', false)`);
    await expect(
      seed(`update attendance_days set status = 'closed' where id = $1`, [dayId]),
    ).resolves.not.toThrow();
  });
});

describe.runIf(dbAvailable)("dispute_items writes are manager-only (0015)", () => {
  it("a teacher cannot add an item to their org's dispute", async () => {
    const { orgId, dayId, childId, teacherClaims } = await seedOrgWithManagerTeacherAndDay();
    const checkId = randomUUID();
    await seed(
      `insert into state_checks (id, org_id, day_id, child_id, our_status, result, reason)
       values ($1, $2, $3, $4, 'present', 'rejected', 'xatolik')`,
      [checkId, orgId, dayId, childId],
    );
    const disputeId = randomUUID();
    await seed(`insert into disputes (id, org_id, period_month, title) values ($1, $2, current_date, 'X')`, [
      disputeId,
      orgId,
    ]);

    // dispute_items_write carried is_manager() in USING but not in WITH
    // CHECK, and INSERT only consults WITH CHECK — so deleting and editing
    // were blocked while *adding* was wide open. A dispute is the document
    // that goes to the state.
    await expect(
      withTenant(teacherClaims, (client) =>
        client.query(`insert into dispute_items (dispute_id, check_id) values ($1, $2)`, [disputeId, checkId]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
