import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// A no-op wrapper when SENTRY_ORG/SENTRY_PROJECT aren't set (local dev, CI,
// any deploy that hasn't configured Sentry yet) — it just skips source map
// upload rather than failing the build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
