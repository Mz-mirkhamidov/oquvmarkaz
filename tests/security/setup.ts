import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

/**
 * RLS is pure Postgres, so these tests run against a plain `postgres:15`
 * service container (CI) or local cluster (dev) — no Supabase Cloud
 * project needed. We replicate the two things a real Supabase project
 * provides that our migrations assume: the `anon`/`authenticated`/
 * `service_role` roles, and a broad baseline grant that 0002/0003's
 * `revoke` statements narrow.
 */

const connectionString =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/qalqon_test";

export const pool = new Pool({ connectionString });

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

export async function resetDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN BYPASSRLS;
        END IF;
      END $$;
    `);

    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      -- 0007 moves pg_trgm into the extensions schema (IF NOT EXISTS) —
      -- drop it too so a rerun doesn't leave the extension registered
      -- outside public, which would make 0001's own (schema-less) CREATE
      -- EXTENSION call a no-op and leave its index's unqualified
      -- gin_trgm_ops unresolved.
      DROP SCHEMA IF EXISTS extensions CASCADE;
    `);

    // 0005_storage.sql needs Supabase's `storage` schema, which doesn't
    // exist on a bare Postgres instance — everything it depends on
    // (auth_org_id(), the base tables) is still covered by the rest.
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") && f !== "0005_storage.sql")
      .sort();

    for (const file of files) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query(sql);

      // Mirror Supabase's own baseline grants right after the base schema
      // exists, so 0002/0003's `revoke` statements have something to
      // narrow — same ordering a real project has (Supabase grants broadly,
      // our migrations tighten it).
      if (file === "0001_init.sql") {
        await client.query(`
          GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
          GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
          GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
        `);
      }
    }
  } finally {
    client.release();
  }
}

export interface JwtClaims {
  sub: string;
  org_id: string;
  user_role: "owner" | "director" | "teacher";
}

/**
 * Runs `fn` inside a transaction acting as a given tenant (or `anon` when
 * claims is null), exactly like PostgREST does per-request: SET LOCAL ROLE
 * + a transaction-scoped `request.jwt.claims` setting. Always rolls back,
 * so tests never leak state into one another regardless of outcome.
 */
export async function withTenant<T>(
  claims: JwtClaims | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (claims) {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(claims),
      ]);
    } else {
      await client.query("SET LOCAL ROLE anon");
    }
    return await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

/**
 * Seed helper — runs as the connecting (superuser) role, which owns every
 * table and so bypasses RLS automatically. Each test seeds its own
 * randomly-keyed orgs/rows rather than relying on a reset between tests,
 * so seeding can be a plain autocommitted query.
 */
export async function seed(sql: string, params?: unknown[]): Promise<void> {
  await pool.query(sql, params);
}
