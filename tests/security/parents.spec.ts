// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { pool, resetDatabase, seed, withTenant, type JwtClaims } from "./setup";

// Parent linking and notifications (M6, TZ §9). Same real-Postgres approach
// as tenant-isolation.spec.ts — see that file for why.

let dbAvailable = true;
try {
  await resetDatabase();
} catch (err) {
  dbAvailable = false;
  console.warn("parents tests skipped — no reachable Postgres (set TEST_DATABASE_URL):", (err as Error).message);
}

afterAll(async () => {
  await pool.end().catch(() => {});
});

async function seedOrgWithManagerTeacherAndChild(orgName = "Test bogcha") {
  const orgId = randomUUID();
  const managerId = randomUUID();
  const teacherId = randomUUID();
  const childId = randomUUID();

  await seed(`insert into organizations (id, name, org_type) values ($1, $2, 'oilaviy')`, [orgId, orgName]);
  await seed(
    `insert into app_users (id, org_id, full_name, role, telegram_id) values ($1, $2, 'Owner', 'owner', $3)`,
    [managerId, orgId, Math.floor(Math.random() * 1e9)],
  );
  await seed(
    `insert into app_users (id, org_id, full_name, role, pin_hash) values ($1, $2, 'Teacher', 'teacher', 'x')`,
    [teacherId, orgId],
  );
  await seed(`insert into children (id, org_id, full_name) values ($1, $2, 'Test Child')`, [childId, orgId]);

  const managerClaims: JwtClaims = { sub: managerId, org_id: orgId, user_role: "owner" };
  const teacherClaims: JwtClaims = { sub: teacherId, org_id: orgId, user_role: "teacher" };
  return { orgId, managerId, teacherId, childId, managerClaims, teacherClaims };
}

describe.runIf(dbAvailable)("parents RLS", () => {
  it("a manager can create a parent and link a child in their own org", async () => {
    const { orgId, childId, managerClaims } = await seedOrgWithManagerTeacherAndChild();

    const rows = await withTenant(managerClaims, async (client) => {
      const { rows: inserted } = await client.query(
        `insert into parents (org_id, full_name, link_code) values ($1, 'Ota', 'ABCD1234') returning id`,
        [orgId],
      );
      await client.query(`insert into parent_children (parent_id, child_id) values ($1, $2)`, [
        inserted[0].id,
        childId,
      ]);
      return client.query("select id from parents where org_id = $1", [orgId]);
    });
    expect(rows.rows).toHaveLength(1);
  });

  it("a teacher cannot read or write parents", async () => {
    const { orgId, teacherClaims } = await seedOrgWithManagerTeacherAndChild();

    await expect(
      withTenant(teacherClaims, (client) =>
        client.query(`insert into parents (org_id, full_name, link_code) values ($1, 'Ota', 'WXYZ5678')`, [
          orgId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);

    const rows = await withTenant(teacherClaims, (client) => client.query("select id from parents"));
    expect(rows.rows).toHaveLength(0);
  });

  it("org A cannot see org B's parents", async () => {
    const a = await seedOrgWithManagerTeacherAndChild("Org A");
    const b = await seedOrgWithManagerTeacherAndChild("Org B");

    await seed(`insert into parents (org_id, full_name, link_code) values ($1, 'Ota B', 'ORGB0000')`, [
      b.orgId,
    ]);

    const rows = await withTenant(a.managerClaims, (client) =>
      client.query("select id from parents where org_id = $1", [b.orgId]),
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe.runIf(dbAvailable)("notification_outbox RLS", () => {
  it("has no write policy for authenticated at all — even a manager can't insert directly", async () => {
    const { orgId, childId, managerClaims } = await seedOrgWithManagerTeacherAndChild();

    await expect(
      withTenant(managerClaims, (client) =>
        client.query(
          `insert into notification_outbox (org_id, child_id, kind, payload) values ($1, $2, 'arrival', '{}')`,
          [orgId, childId],
        ),
      ),
    ).rejects.toThrow(/row-level security|permission denied/i);
  });

  it("a manager can read their own org's outbox rows but not another org's", async () => {
    const a = await seedOrgWithManagerTeacherAndChild("Org A");
    const b = await seedOrgWithManagerTeacherAndChild("Org B");

    await seed(
      `insert into notification_outbox (org_id, child_id, kind, payload) values ($1, $2, 'arrival', '{}')`,
      [a.orgId, a.childId],
    );
    await seed(
      `insert into notification_outbox (org_id, child_id, kind, payload) values ($1, $2, 'arrival', '{}')`,
      [b.orgId, b.childId],
    );

    const ownRows = await withTenant(a.managerClaims, (client) =>
      client.query("select id from notification_outbox where org_id = $1", [a.orgId]),
    );
    expect(ownRows.rows).toHaveLength(1);

    const otherRows = await withTenant(a.managerClaims, (client) =>
      client.query("select id from notification_outbox where org_id = $1", [b.orgId]),
    );
    expect(otherRows.rows).toHaveLength(0);
  });
});
