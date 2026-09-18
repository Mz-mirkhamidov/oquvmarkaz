import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Not used to issue our own session anymore (Better Auth owns sessions) —
  // kept only to mint short-lived PostgREST bearer tokens inside
  // lib/auth/guard.ts, so the ~25 non-auth routes that still read/write via
  // requestDb() (RLS over PostgREST) keep working unchanged. See TZ v2 §3.1
  // for why that migration to direct Postgres is out of this rebuild's scope.
  SUPABASE_JWT_SECRET: z.string().min(1),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),

  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Tashkent"),
  CRON_SECRET: z.string().min(1).optional(),

  STORAGE_PROVIDER: z.enum(["supabase", "s3"]).default("supabase"),

  // Better Auth (TZ v2 §13)
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // qalqon_auth role — owns/bypasses RLS on the Better Auth tables plus
  // login_tokens, rate_limits, auth_events (TZ v2 §5.3).
  AUTH_DATABASE_URL: z.string().min(1),
  // qalqon_app role — RLS-constrained, used by lib/db/with-org.ts for the
  // handful of app tables auth code itself touches (currently: devices).
  DATABASE_URL: z.string().min(1),
  SELFTEST_KEY: z.string().min(16),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Lazily validated server-only env access. Not called at module scope
 * anywhere, so routes that don't need a given var (e.g. Telegram) don't
 * fail to import during build when it's unset.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}
