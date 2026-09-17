import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),

  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Tashkent"),
  CRON_SECRET: z.string().min(1).optional(),

  STORAGE_PROVIDER: z.enum(["supabase", "s3"]).default("supabase"),
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
