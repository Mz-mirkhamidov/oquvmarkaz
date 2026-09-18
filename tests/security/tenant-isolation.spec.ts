// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { pool, resetDatabase, seed, withTenant, type JwtClaims } from "./setup";

// Mandatory per TZ §11.3 / §17.1. RLS is pure Postgres, so these run
// against a real Postgres instance (a service container in CI, see
// .github/workflows/ci.yml) rather than mocks — a mock can't tell us
// whether the actual SQL policies in 0002_rls.sql hold up.
//
// Skips gracefully when no test database is reachable (e.g. a
// contributor running `pnpm test` without Postgres installed locally).
// This has to be a top-level await, not a beforeAll: `describe.runIf`
// below is evaluated during collection, before any beforeAll hook runs,
// so a flag only beforeAll sets would always read as its initial value.

let dbAvailable = true;
try {
  await resetDatabase();
} catch (err) {
  dbAvailable = false;
  console.warn(
    "tenant-isolation tests skipped — no reachable Postgres (set TEST_DATABASE_URL):",
    (err as Error).message,
  );
}

afterAll(async () => {
  await pool.end().catch(() => {});
});

async function seedOrgWithChild() {
  const orgId = randomUUID();
  const managerId = randomUUID();
  const childId = randomUUID();
  await seed(
    `insert into organizations (id, name, org_type) values ($1, 'Test bogcha', 'oilaviy')`,
    [orgId],
  );
  await seed(
    `insert into "user" (id, name, email, "emailVerified", "fullName", "appRole", "orgId", "telegramId", "isActive")
     values ($1, 'Owner', $2, true, 'Owner', 'owner', $3, $4, true)`,
    [managerId, `owner-${managerId}@test.local`, orgId, String(Math.floor(Math.random() * 1e9))],
  );
  await seed(
    `insert into children (id, org_id, full_name) values ($1, $2, 'Test Child')`,
    [childId, orgId],
  );
  const managerClaims: JwtClaims = { sub: managerId, org_id: orgId, user_role: "owner" };
  return { orgId, managerId, childId, managerClaims };
}

describe.runIf(dbAvailable)("T6 — tenant isolation", () => {
  it("org A cannot read org B's children through RLS", async () => {
    const a = await seedOrgWithChild();
    const b = await seedOrgWithChild();

    const rows = await withTenant(a.managerClaims, (client) =>
      client.query("select id from children where id = $1", [b.childId]),
    );
    expect(rows.rows).toHaveLength(0);

    const ownRows = await withTenant(a.managerClaims, (client) =>
      client.query("select id from children where id = $1", [a.childId]),
    );
    expect(ownRows.rows).toHaveLength(1);
  });

  it("org A cannot read org B's user or organizations rows", async () => {
    const a = await seedOrgWithChild();
    const b = await seedOrgWithChild();

    // "user" (TZ v2 §5.3, 0014_better_auth_rls.sql) has RLS enabled with
    // zero policies and no table-level grant to `authenticated` at all —
    // a stronger guarantee than the usual "RLS filters it to zero rows":
    // the query is rejected outright rather than merely returning nothing.
    await expect(
      withTenant(a.managerClaims, (client) =>
        client.query('select id from "user" where "orgId" = $1', [b.orgId]),
      ),
    ).rejects.toThrow(/permission denied/i);

    const orgs = await withTenant(a.managerClaims, (client) =>
      client.query("select id from organizations where id = $1", [b.orgId]),
    );
    expect(orgs.rows).toHaveLength(0);
  });
});

describe.runIf(dbAvailable)("T7 — teacher sees only their own group", () => {
  it("restricts a teacher's children read to their assigned group", async () => {
    const orgId = randomUUID();
    const teacherId = randomUUID();
    const groupAId = randomUUID();
    const groupBId = randomUUID();
    const childAId = randomUUID();
    const childBId = randomUUID();

    await seed(`insert into organizations (id, name, org_type) values ($1, 'Org', 'dxsh')`, [
      orgId,
    ]);
    await seed(
      `insert into "user" (id, name, email, "emailVerified", "fullName", "appRole", "orgId", "pinHash", "isActive")
       values ($1, 'Teacher', $2, true, 'Teacher', 'teacher', $3, 'x', true)`,
      [teacherId, `teacher-${teacherId}@test.local`, orgId],
    );
    await seed(`insert into groups (id, org_id, name, teacher_id) values ($1, $2, 'A', $3)`, [
      groupAId,
      orgId,
      teacherId,
    ]);
    await seed(`insert into groups (id, org_id, name) values ($1, $2, 'B')`, [groupBId, orgId]);
    await seed(`insert into children (id, org_id, group_id, full_name) values ($1, $2, $3, 'Child A')`, [
      childAId,
      orgId,
      groupAId,
    ]);
    await seed(`insert into children (id, org_id, group_id, full_name) values ($1, $2, $3, 'Child B')`, [
      childBId,
      orgId,
      groupBId,
    ]);

    const teacherClaims: JwtClaims = { sub: teacherId, org_id: orgId, user_role: "teacher" };
    const rows = await withTenant(teacherClaims, (client) =>
      client.query("select id from children order by full_name"),
    );

    expect(rows.rows.map((r) => r.id)).toEqual([childAId]);
  });
});

describe.runIf(dbAvailable)("T8 — attendance_records is append-only", () => {
  it("rejects UPDATE and DELETE from the authenticated role", async () => {
    const { orgId, childId, managerClaims } = await seedOrgWithChild();
    const dayId = randomUUID();
    const recordId = randomUUID();

    await seed(`insert into attendance_days (id, org_id, day_date) values ($1, $2, current_date)`, [
      dayId,
      orgId,
    ]);
    await seed(
      `insert into attendance_records (id, org_id, day_id, child_id, status) values ($1, $2, $3, $4, 'present')`,
      [recordId, orgId, dayId, childId],
    );

    await expect(
      withTenant(managerClaims, (client) =>
        client.query("update attendance_records set status = 'absent' where id = $1", [recordId]),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withTenant(managerClaims, (client) =>
        client.query("delete from attendance_records where id = $1", [recordId]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
