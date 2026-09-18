// @vitest-environment node
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { pool, resetDatabase, seed, type JwtClaims } from "./setup";

// TZ v2 §16 — the five mandatory-in-CI auth tests not already covered by
// tenant-isolation.spec.ts (A-T18): A-T2 (token replay), A-T4 (concurrent
// consumption), A-T19 (qalqon_app doesn't bypass RLS). Real Postgres, same
// approach as the rest of tests/security — see tenant-isolation.spec.ts.

let dbAvailable = true;
try {
  await resetDatabase();
} catch (err) {
  dbAvailable = false;
  console.warn("auth-flow tests skipped — no reachable Postgres (set TEST_DATABASE_URL):", (err as Error).message);
}

afterAll(async () => {
  await pool.end().catch(() => {});
});

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function seedLoginToken() {
  const raw = randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  const telegramId = Math.floor(Math.random() * 1e9);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await seed(
    `insert into login_tokens (token_hash, telegram_id, chat_id, expires_at) values ($1, $2, $2, $3)`,
    [hash, telegramId, expiresAt.toISOString()],
  );
  return { raw, hash, telegramId };
}

/** Mirrors the atomic UPDATE in lib/auth/plugins/telegram-login.ts exactly. */
async function consumeToken(hash: string) {
  return pool.query<{ telegram_id: string; expired: boolean }>(
    `update login_tokens
       set consumed_at = now(), consumed_ip = '127.0.0.1'
     where token_hash = $1
       and consumed_at is null
     returning telegram_id, (expires_at < now()) as expired`,
    [hash],
  );
}

describe.runIf(dbAvailable)("A-T2 — a login token can only be consumed once", () => {
  it("the second consumption attempt affects zero rows (TOKEN_INVALID)", async () => {
    const { hash } = await seedLoginToken();

    const first = await consumeToken(hash);
    expect(first.rows).toHaveLength(1);

    const second = await consumeToken(hash);
    expect(second.rows).toHaveLength(0);
  });
});

describe.runIf(dbAvailable)("A-T4 — two parallel consumption attempts, only one wins", () => {
  it("only one of two concurrent UPDATEs on the same token returns a row", async () => {
    const { hash } = await seedLoginToken();

    const [a, b] = await Promise.all([consumeToken(hash), consumeToken(hash)]);
    const successes = [a, b].filter((r) => r.rows.length === 1);
    expect(successes).toHaveLength(1);
  });
});

describe.runIf(dbAvailable)("A-T19 — qalqon_app does not bypass RLS", () => {
  /**
   * Unlike withTenant (setup.ts), which plays the PostgREST role
   * (`authenticated`), this connects as the real `qalqon_app` role from
   * 0012_app_role.sql — the one lib/db/app-pool.ts's DATABASE_URL actually
   * authenticates as in production.
   */
  async function asQalqonApp<T>(
    claims: JwtClaims | null,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE qalqon_app");
      if (claims) {
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify(claims),
        ]);
      }
      return await fn(client);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  }

  it("devices: org A cannot see org B's devices even connected directly as qalqon_app", async () => {
    const orgA = randomUUID();
    const orgB = randomUUID();
    await seed(`insert into organizations (id, name, org_type) values ($1, 'Org A', 'oilaviy')`, [orgA]);
    await seed(`insert into organizations (id, name, org_type) values ($1, 'Org B', 'oilaviy')`, [orgB]);
    await seed(`insert into devices (id, org_id, secret_hash) values ($1, $2, $3)`, [
      randomUUID(),
      orgB,
      randomBytes(32).toString("hex"),
    ]);

    const claimsA: JwtClaims = { sub: randomUUID(), org_id: orgA, user_role: "owner" };
    const rows = await asQalqonApp(claimsA, (client) =>
      client.query("select id from devices where org_id = $1", [orgB]),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('"user": qalqon_app has a table-level grant (0012\'s blanket grant predates it in migration order) but 0014\'s RLS-with-no-policy blocks every row', async () => {
    // SELECT: the grant lets the query run, RLS-with-no-policy filters
    // every row — this is Postgres's normal "grant present, no USING
    // policy" behavior, distinct from tenant-isolation.spec.ts's "user"
    // case where `authenticated` has no grant on it at all.
    const rows = await asQalqonApp(null, (client) => client.query('select id from "user"'));
    expect(rows.rows).toHaveLength(0);

    // INSERT: no WITH CHECK policy exists either, so a write is rejected
    // outright rather than silently filtered.
    await expect(
      asQalqonApp(null, (client) =>
        client.query(
          `insert into "user" (id, name, email, "emailVerified") values ($1, 'x', $2, true)`,
          [randomUUID(), `${randomUUID()}@test.local`],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
