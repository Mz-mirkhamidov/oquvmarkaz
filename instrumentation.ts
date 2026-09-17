import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge error monitoring (M7 — TZ deployment plan). No-op when
 * SENTRY_DSN is unset, which is the default in every environment this
 * project doesn't explicitly configure it in (local dev, CI).
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Attendance/child data must never leave this app's own database —
    // Sentry gets stack traces and request metadata, not payloads.
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
