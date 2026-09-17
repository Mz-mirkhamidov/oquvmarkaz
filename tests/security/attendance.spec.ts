// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { pool, resetDatabase, seed, withTenant, type JwtClaims } from "./setup";

// Covers the correction/close mechanics added in
// 0006_attendance_corrections.sql: same-day re-marks and closed-day
// corrections both go through supersede_attendance_record(), and
// guard_closed_day() has to tell those two cases apart.

let dbAvailable = true;
try {
  await resetDatabase();
} catch (err) {
  dbAvailable = false;
  console.warn(
    "attendance tests skipped — no reachable Postgres (set TEST_DATABASE_URL):",
    (err as Error).message,
  );
}

afterAll(async () => {
  await pool.end().catch(() => {});
});

async function seedOrgChildDay() {
  const orgId = randomUUID();
  const managerId = randomUUID();
  const childId = randomUUID();
  const dayId = randomUUID();

  await seed(`insert into organizations (id, name, org_type) values ($1, 'Test', 'oilaviy')`, [orgId]);
  await seed(
    `insert into app_users (id, org_id, full_name, role, telegram_id) values ($1, $2, 'Owner', 'owner', $3)`,
    [managerId, orgId, Math.floor(Math.random() * 1e9)],
  );
  await seed(`insert into children (id, org_id, full_name) values ($1, $2, 'Child')`, [childId, orgId]);
  await seed(`insert into attendance_days (id, org_id, day_date) values ($1, $2, current_date)`, [
    dayId,
    orgId,
  ]);

  const claims: JwtClaims = { sub: managerId, org_id: orgId, user_role: "owner" };
  return { orgId, managerId, childId, dayId, claims };
}

describe.runIf(dbAvailable)("supersede_attendance_record", () => {
  it("marks the old record non-current and links the new one via supersedes_id", async () => {
    const { orgId, managerId, childId, dayId, claims } = await seedOrgChildDay();
    const firstId = randomUUID();
    const secondId = randomUUID();

    await seed(
      `insert into attendance_records (id, org_id, day_id, child_id, status, marked_by) values ($1,$2,$3,$4,'present',$5)`,
      [firstId, orgId, dayId, childId, managerId],
    );

    // Both queries run inside the same withTenant transaction — withTenant
    // always rolls back at the end, so a second, separate call would never
    // see the first call's effects (they'd already be undone).
    const { result, oldRow } = await withTenant(claims, async (client) => {
      const result = await client.query(
        `select * from supersede_attendance_record($1,$2,$3,$4,'absent',$5,null,now(),null,null)`,
        [secondId, orgId, dayId, childId, managerId],
      );
      const oldRow = await client.query(
        "select id, is_current from attendance_records where id = $1",
        [firstId],
      );
      return { result, oldRow };
    });

    expect(result.rows[0].id).toBe(secondId);
    expect(result.rows[0].supersedes_id).toBe(firstId);
    expect(result.rows[0].is_current).toBe(true);
    expect(oldRow.rows[0].is_current).toBe(false);
  });

  it("rejects a org_id that doesn't match the caller's JWT claim", async () => {
    const { managerId, childId, dayId, claims } = await seedOrgChildDay();
    const otherOrgId = randomUUID();

    await expect(
      withTenant(claims, (client) =>
        client.query(
          `select * from supersede_attendance_record($1,$2,$3,$4,'present',$5,null,now(),null,null)`,
          [randomUUID(), otherOrgId, dayId, childId, managerId],
        ),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe.runIf(dbAvailable)("guard_closed_day (T5)", () => {
  it("rejects a brand-new mark on a closed day", async () => {
    const { orgId, managerId, childId, dayId, claims } = await seedOrgChildDay();
    await seed(`update attendance_days set status = 'closed' where id = $1`, [dayId]);

    await expect(
      withTenant(claims, (client) =>
        client.query(
          `insert into attendance_records (id, org_id, day_id, child_id, status, marked_by) values ($1,$2,$3,$4,'present',$5)`,
          [randomUUID(), orgId, dayId, childId, managerId],
        ),
      ),
    ).rejects.toThrow(/DAY_CLOSED/);
  });

  it("still allows a correction (supersedes_id set) on a closed day", async () => {
    const { orgId, managerId, childId, dayId, claims } = await seedOrgChildDay();
    const originalId = randomUUID();

    await seed(
      `insert into attendance_records (id, org_id, day_id, child_id, status, marked_by) values ($1,$2,$3,$4,'present',$5)`,
      [originalId, orgId, dayId, childId, managerId],
    );
    await seed(`update attendance_days set status = 'closed' where id = $1`, [dayId]);

    const result = await withTenant(claims, (client) =>
      client.query(
        `select * from supersede_attendance_record($1,$2,$3,$4,'sick',$5,null,now(),null,'davlat tizimi qabul qilmadi')`,
        [randomUUID(), orgId, dayId, childId, managerId],
      ),
    );
    expect(result.rows[0].correction_note).toBe("davlat tizimi qabul qilmadi");
    expect(result.rows[0].supersedes_id).toBe(originalId);
  });
});

describe.runIf(dbAvailable)("attendance_photos is append-only (T9)", () => {
  it("allows an org-scoped insert but rejects UPDATE and DELETE from authenticated", async () => {
    const { orgId, childId, dayId, managerId, claims } = await seedOrgChildDay();
    const recordId = randomUUID();
    const photoId = randomUUID();

    await seed(
      `insert into attendance_records (id, org_id, day_id, child_id, status, marked_by) values ($1,$2,$3,$4,'present',$5)`,
      [recordId, orgId, dayId, childId, managerId],
    );

    const hash = "a".repeat(64);
    const insertRes = await withTenant(claims, (client) =>
      client.query(
        `insert into attendance_photos (id, org_id, record_id, child_id, storage_path, sha256, bytes, taken_at)
         values ($1,$2,$3,$4,'path/to.webp',$5,1000,now()) returning id`,
        [photoId, orgId, recordId, childId, hash],
      ),
    );
    expect(insertRes.rows[0].id).toBe(photoId);

    await expect(
      withTenant(claims, (client) =>
        client.query("update attendance_photos set sha256 = $1 where id = $2", [
          "b".repeat(64),
          photoId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withTenant(claims, (client) =>
        client.query("delete from attendance_photos where id = $1", [photoId]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("rejects a photo pointed at another org's record via RLS", async () => {
    const a = await seedOrgChildDay();
    const b = await seedOrgChildDay();
    const recordId = randomUUID();

    await seed(
      `insert into attendance_records (id, org_id, day_id, child_id, status, marked_by) values ($1,$2,$3,$4,'present',$5)`,
      [recordId, a.orgId, a.dayId, a.childId, a.managerId],
    );

    // org B's session trying to attach a photo under org A's org_id — RLS's
    // records_insert/photos_insert check (org_id = auth_org_id()) blocks it.
    await expect(
      withTenant(b.claims, (client) =>
        client.query(
          `insert into attendance_photos (id, org_id, record_id, child_id, storage_path, sha256, bytes, taken_at)
           values ($1,$2,$3,$4,'path/to.webp',$5,1000,now())`,
          [randomUUID(), a.orgId, recordId, a.childId, "c".repeat(64)],
        ),
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});
