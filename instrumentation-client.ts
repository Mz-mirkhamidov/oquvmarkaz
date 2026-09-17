import * as Sentry from "@sentry/nextjs";

// Client-side error monitoring — the Turbopack-compatible file convention
// (Next.js 15.3+) replacing the older sentry.client.config.ts auto-load,
// same reasoning as public/sw.js's hand-written service worker: the
// webpack-only auto-loading mechanism Sentry's docs describe doesn't fire
// under Turbopack, which is this project's default bundler.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
